import {
  compareScores,
  rankStations,
  readJourney,
  shortlistVenues,
  verifiedRecommendation,
} from '../../../packages/fairness/src/prim.ts';
import type {
  Outing,
  RecommendationResponse,
  Station,
  Venue,
} from '../../../packages/shared/src/index.ts';
import type { createPrimClient } from './prim-client.ts';
export type RecommendationServices = {
  prim: ReturnType<typeof createPrimClient>;
  stations: () => Promise<Station[]>;
  venues: (stationIds: string[]) => Promise<Venue[]>;
  save: (result: RecommendationResponse) => Promise<boolean>;
};
export async function calculateRecommendations(
  outing: Outing,
  services: RecommendationServices,
  now = Date.now(),
) {
  const startsAt = Date.parse(outing.startsAt) / 1000, endsAt = Date.parse(outing.endsAt) / 1000;
  const freshness = Date.parse(outing.startsAt) - now <= 2 * 3600_000
    ? 'realtime'
    : 'base_schedule';
  const result: RecommendationResponse = {
    source: 'prim',
    computedAt: new Date(now).toISOString(),
    recommendations: [],
    warnings: [],
    progress: { stage: 'isochrones', completed: 0, total: outing.participants.length },
  };
  let writes = Promise.resolve(true);
  const publish = () => {
    const copy = structuredClone(result);
    writes = writes.then(async () => {
      if (!await services.save(copy)) throw new Error('La sortie a changé.');
      return true;
    });
    return writes;
  };
  try {
    const stations = await services.stations(),
      stationMap = new Map(stations.map((station) => [station.id, station]));
    const ref = (id: string) => {
      const station = stationMap.get(id);
      if (!station) throw new Error('Station indisponible.');
      return `${station.longitude};${station.latitude}`;
    };
    const isochrones = await Promise.all(outing.participants.map(async (person) => {
      const times = await services.prim.isochrone(
        ref(person.departureId),
        outing.startsAt,
        freshness,
      );
      result.progress!.completed++;
      await publish();
      return { participantId: person.id, times };
    }));
    const ranked = rankStations(isochrones).filter((candidate) =>
      stationMap.has(candidate.stationId)
    );
    result.stationCandidates = ranked.slice(0, 20);
    result.progress = { stage: 'returns', completed: 0, total: 3 };
    await publish();
    const choices = shortlistVenues(
      ranked,
      await services.venues(ranked.map((station) => station.stationId)),
      startsAt,
      endsAt,
      outing.activity,
    );
    result.progress.total = choices.length;
    result.stationCandidates = ranked.filter(station => choices.some(venue => venue.stationId === station.stationId)).slice(0, 20);
    await publish();
    await Promise.all(choices.map(async (venue) => {
      const venueRef = `${venue.longitude};${venue.latitude}`;
      const journeys = await Promise.all(outing.participants.map(async (person) => {
        const [outboundRaw, inboundRaw] = await Promise.all([
          services.prim.journey(
            ref(person.departureId),
            venueRef,
            outing.startsAt,
            'arrival',
            freshness,
          ),
          services.prim.journey(
            venueRef,
            ref(person.returnId),
            outing.endsAt,
            'departure',
            Date.parse(outing.endsAt) - now <= 2 * 3600_000 ? 'realtime' : 'base_schedule',
          ),
        ]);
        const outbound = readJourney(outboundRaw, startsAt, 'arrival'),
          inbound = readJourney(inboundRaw, endsAt, 'departure');
        return outbound && inbound ? { participantId: person.id, outbound, inbound } : null;
      }));
      const known = journeys.filter((journey): journey is NonNullable<typeof journey> =>
        journey !== null
      );
      const verified = verifiedRecommendation(venue, outing.participants, known);
      if (verified) result.recommendations.push(verified);
      result.recommendations.sort((a, b) =>
        compareScores(a, b) || a.venue.id.localeCompare(b.venue.id)
      );
      result.progress!.completed++;
      await publish();
    }));
    result.progress.stage = 'complete';
    result.warnings = [
      'Présélection par isochrones à l’heure du rendez-vous. Allers à l’arrivée et retours après la soirée vérifiés pour trois lieux au maximum.',
      'Horaires des lieux issus d’OpenStreetMap. Vérifie-les avant de partir.',
    ];
    await publish();
    return result;
  } catch (cause) {
    result.progress = { stage: 'failed', completed: 0, total: 0 };
    result.recommendations = [];
    result.warnings = [cause instanceof Error && cause.message.startsWith('Quota PRIM')
      ? cause.message
      : 'Les trajets n’ont pas pu être vérifiés. Réessaie dans un instant.'];
    await publish();
    return result;
  }
}

/** Verify one explicitly selected venue. No isochrone and no fairness search. */
export async function calculateSelectedVenue(
  outing: Outing,
  services: RecommendationServices,
  now = Date.now(),
): Promise<RecommendationResponse> {
  const result: RecommendationResponse = {
    source: 'prim', computedAt: new Date(now).toISOString(), recommendations: [], warnings: [],
    progress: { stage: 'returns', completed: 0, total: 1 },
  };
  const publish = async () => {
    if (!await services.save(structuredClone(result))) throw new Error('La sortie a changé.');
  };
  try {
    const chosen = outing.selectedVenue;
    if (!chosen || outing.participants.length < 2) throw new Error('Choisis un lieu et ajoute un ami.');
    const venue = (await services.venues([chosen.stationId])).find(v => v.id === chosen.id);
    if (!venue) throw new Error('Ce lieu n’est plus disponible pour ce créneau.');
    const stations = new Map((await services.stations()).map(s => [s.id, s]));
    const ref = (id: string) => {
      const station = stations.get(id);
      if (!station) throw new Error('Station indisponible.');
      return `${station.longitude};${station.latitude}`;
    };
    const venueRef = `${venue.longitude};${venue.latitude}`;
    const startsAt = Date.parse(outing.startsAt) / 1000, endsAt = Date.parse(outing.endsAt) / 1000;
    await publish();
    const journeys = await Promise.all(outing.participants.map(async person => {
      const [outboundRaw, inboundRaw] = await Promise.all([
        services.prim.journey(ref(person.departureId), venueRef, outing.startsAt, 'arrival', Date.parse(outing.startsAt) - now <= 7200000 ? 'realtime' : 'base_schedule'),
        services.prim.journey(venueRef, ref(person.returnId), outing.endsAt, 'departure', Date.parse(outing.endsAt) - now <= 7200000 ? 'realtime' : 'base_schedule'),
      ]);
      const outbound = readJourney(outboundRaw, startsAt, 'arrival');
      const inbound = readJourney(inboundRaw, endsAt, 'departure');
      return outbound && inbound ? { participantId: person.id, outbound, inbound } : null;
    }));
    const verified = verifiedRecommendation(venue, outing.participants, journeys.filter((j): j is NonNullable<typeof j> => j !== null));
    result.recommendations = verified ? [verified] : [];
    result.progress = { stage: 'complete', completed: 1, total: 1 };
    result.warnings = ['Lieu choisi manuellement. Aucun calcul du juste milieu.', 'Allers à l’heure du rendez-vous et retours après la fin vérifiés. Horaires OpenStreetMap à confirmer auprès du lieu.'];
    if (!verified) result.warnings = ['Ce lieu ne permet pas de vérifier l’aller et le retour de tout le groupe. Choisis un autre lieu ou un autre créneau.'];
  } catch (cause) {
    result.progress = { stage: 'failed', completed: 0, total: 1 };
    result.recommendations = [];
    result.warnings = [cause instanceof Error && (cause.message.startsWith('Quota PRIM') || cause.message.startsWith('Ce lieu')) ? cause.message : 'Les allers et retours n’ont pas pu être vérifiés. Réessaie.'];
  }
  await publish();
  return result;
}
