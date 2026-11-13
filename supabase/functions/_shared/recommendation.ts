import {
  compareScores,
  rankStations,
  readJourney,
  shortlistVenues,
  verifiedRecommendation,
} from '../../../packages/fairness/src/prim.ts';
import type { StationScore, StationTimes } from '../../../packages/fairness/src/prim.ts';
import { venueJourney } from '../../../packages/fairness/src/engine.ts';
import type {
  Outing,
  Participant,
  Recommendation,
  RecommendationResponse,
  Station,
  Venue,
} from '../../../packages/shared/src/index.ts';
import type { createPrimClient } from './prim-client.ts';
import type { EngineClient } from './engine-client.ts';
import { TransitError } from './engine-client.ts';

/** Times of one outing, in Unix seconds. */
export type OutingWindow = { startsAt: number; endsAt: number };
export type StationLookup = (id: string) => Station;
export type VenueCheck = { journeys: Recommendation['journeys']; onDemandOnly: boolean };
/** Journey provider: PRIM during the transition, then the transit engine. */
export type TransitRouter = {
  source: RecommendationResponse['source'];
  /** Warnings shown with every completed result of this provider. */
  notes: string[];
  isochrone: (person: Participant, window: OutingWindow, station: StationLookup) => Promise<StationTimes>;
  /**
   * Fairness ranking of `targets` by the provider itself, best first. When present, it replaces the isochrones:
   * the transit engine answers with about 15 000 stations per isochrone, too much to cross inside an Edge Function.
   */
  rank?: (participants: Participant[], window: OutingWindow, targets: string[]) => Promise<StationScore[]>;
  /** Outbound by the start and return after the end, for every participant. Missing journeys are left out. */
  verify: (venue: Venue, participants: Participant[], window: OutingWindow, station: StationLookup) => Promise<VenueCheck>;
};
export type RecommendationServices = {
  router: TransitRouter;
  stations: () => Promise<Station[]>;
  /** Open venues of the first `stationCount` stations that have one, in the given order (1 by default, 3 at most). */
  venues: (stationIds: string[], stationCount?: number) => Promise<Venue[]>;
  /** Active stations with an open venue of the activity during the outing. Required by a provider that ranks. */
  venueStations?: () => Promise<string[]>;
  save: (result: RecommendationResponse) => Promise<boolean>;
};

const coordinates = (station: Station) => `${station.longitude};${station.latitude}`;

export function primRouter(prim: ReturnType<typeof createPrimClient>, now = Date.now()): TransitRouter {
  const freshness = (at: number) => at * 1000 - now <= 2 * 3600_000 ? 'realtime' as const : 'base_schedule' as const;
  const iso = (at: number) => new Date(at * 1000).toISOString();
  return {
    source: 'prim',
    notes: [],
    isochrone: (person, window, station) =>
      prim.isochrone(coordinates(station(person.departureId)), iso(window.startsAt), freshness(window.startsAt)),
    async verify(venue, participants, window, station) {
      const venueRef = `${venue.longitude};${venue.latitude}`;
      const journeys = await Promise.all(participants.map(async (person) => {
        const [outboundRaw, inboundRaw] = await Promise.all([
          prim.journey(coordinates(station(person.departureId)), venueRef, iso(window.startsAt), 'arrival', freshness(window.startsAt)),
          prim.journey(venueRef, coordinates(station(person.returnId)), iso(window.endsAt), 'departure', freshness(window.endsAt)),
        ]);
        const outbound = readJourney(outboundRaw, window.startsAt, 'arrival'),
          inbound = readJourney(inboundRaw, window.endsAt, 'departure');
        return outbound && inbound ? { participantId: person.id, outbound, inbound } : null;
      }));
      return { journeys: journeys.filter((journey) => journey !== null), onDemandOnly: false };
    },
  };
}

/** Station to station by the engine, the catalogue walk to the venue added on each side. */
export function engineRouter(engine: EngineClient): TransitRouter {
  return {
    source: 'gtfs',
    notes: ['Horaires théoriques d’Île-de-France Mobilités, sans info trafic pour l’instant. Vérifie ton trajet avant de partir.'],
    isochrone: (person, window) => engine.oneToAll(person.departureId, window.startsAt),
    async rank(participants, window, targets) {
      const answer = await engine.rank({ origins: participants.map(person => ({ key: person.id, station: person.departureId })), arriveBy: window.startsAt, targets });
      return answer.candidates.map(({ durations, ...score }) => ({ ...score, times: durations.map(time => ({ participantId: time.key, duration: time.duration })) }));
    },
    async verify(venue, participants, window) {
      const answer = await engine.journeys({
        items: participants.flatMap((person, index) => [
          { key: `out-${index}`, from: person.departureId, to: venue.stationId, time: window.startsAt - venue.walkSeconds, direction: 'arriveBy' as const },
          { key: `back-${index}`, from: venue.stationId, to: person.returnId, time: window.endsAt + venue.walkSeconds, direction: 'departAfter' as const },
        ]),
      });
      const results = new Map(answer.results.map((result) => [result.key, result]));
      let onDemandOnly = false;
      const journeys = participants.flatMap((person, index) => {
        const out = results.get(`out-${index}`), back = results.get(`back-${index}`);
        if (out?.status === 'none' && out.reason === 'on-demand-only') onDemandOnly = true;
        if (back?.status === 'none' && back.reason === 'on-demand-only') onDemandOnly = true;
        if (out?.status !== 'ok' || back?.status !== 'ok') return [];
        const outbound = venueJourney(out.journey, venue, window.startsAt, 'arrival'),
          inbound = venueJourney(back.journey, venue, window.endsAt, 'departure');
        return outbound && inbound ? [{ participantId: person.id, outbound, inbound }] : [];
      });
      return { journeys, onDemandOnly };
    },
  };
}

const ON_DEMAND = 'Un trajet n’existe qu’avec un transport à la demande, sur réservation. Onyva ne peut pas le garantir.';
function failureMessage(cause: unknown, fallback: string) {
  if (cause instanceof TransitError) return cause.message;
  return cause instanceof Error && cause.message.startsWith('Quota PRIM') ? cause.message : fallback;
}
function lookup(stations: Station[]): StationLookup {
  const map = new Map(stations.map((station) => [station.id, station]));
  return (id) => {
    const station = map.get(id);
    if (!station) throw new Error('Station indisponible.');
    return station;
  };
}

export async function calculateRecommendations(
  outing: Outing,
  services: RecommendationServices,
  now = Date.now(),
) {
  const window = { startsAt: Date.parse(outing.startsAt) / 1000, endsAt: Date.parse(outing.endsAt) / 1000 };
  const { router } = services;
  const result: RecommendationResponse = {
    source: router.source,
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
    let ranked: StationScore[];
    // Station lookup for the PRIM coordinates only: the engine works with station identifiers.
    let station: StationLookup = () => { throw new Error('Station indisponible.'); };
    if (router.rank) {
      if (outing.participants.length < 2 || outing.participants.length > 10) throw new Error('Groupe invalide.');
      const targets = await services.venueStations?.() ?? [];
      // No open venue anywhere: nothing to rank, and the engine refuses an empty list.
      ranked = targets.length ? await router.rank(outing.participants, window, targets) : [];
      result.progress!.completed = outing.participants.length;
    } else {
      const stations = await services.stations(), known = new Set(stations.map((item) => item.id));
      station = lookup(stations);
      const isochrones = await Promise.all(outing.participants.map(async (person) => {
        const times = await router.isochrone(person, window, station);
        result.progress!.completed++;
        await publish();
        return { participantId: person.id, times };
      }));
      ranked = rankStations(isochrones).filter((candidate) => known.has(candidate.stationId));
    }
    result.stationCandidates = ranked.slice(0, 20);
    result.progress = { stage: 'returns', completed: 0, total: 3 };
    await publish();
    const choices = shortlistVenues(
      ranked,
      await services.venues(ranked.map((candidate) => candidate.stationId), 3),
      window.startsAt,
      window.endsAt,
      outing.activity,
    );
    result.progress.total = choices.length;
    result.stationCandidates = ranked.filter(candidate => choices.some(venue => venue.stationId === candidate.stationId)).slice(0, 20);
    await publish();
    let onDemandOnly = false;
    await Promise.all(choices.map(async (venue) => {
      const check = await router.verify(venue, outing.participants, window, station);
      onDemandOnly ||= check.onDemandOnly;
      const verified = verifiedRecommendation(venue, outing.participants, check.journeys);
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
      ...router.notes,
      ...(onDemandOnly ? [ON_DEMAND] : []),
    ];
    await publish();
    return result;
  } catch (cause) {
    result.progress = { stage: 'failed', completed: 0, total: 0 };
    result.recommendations = [];
    result.warnings = [failureMessage(cause, 'Les trajets n’ont pas pu être vérifiés. Réessaie dans un instant.')];
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
  const { router } = services;
  const result: RecommendationResponse = {
    source: router.source, computedAt: new Date(now).toISOString(), recommendations: [], warnings: [],
    progress: { stage: 'returns', completed: 0, total: 1 },
  };
  const publish = async () => {
    if (!await services.save(structuredClone(result))) throw new Error('La sortie a changé.');
  };
  try {
    const chosen = outing.selectedVenue;
    if (!chosen || outing.participants.length < 2) throw new Error('Choisis un lieu et ajoute un ami.');
    const venue = (await services.venues([chosen.stationId])).find(v => v.id === chosen.id);
    if (!venue) throw new TransitError('Ce lieu n’est plus disponible pour ce créneau.');
    const station = lookup(await services.stations());
    const window = { startsAt: Date.parse(outing.startsAt) / 1000, endsAt: Date.parse(outing.endsAt) / 1000 };
    await publish();
    const check = await router.verify(venue, outing.participants, window, station);
    const verified = verifiedRecommendation(venue, outing.participants, check.journeys);
    result.recommendations = verified ? [verified] : [];
    result.progress = { stage: 'complete', completed: 1, total: 1 };
    result.warnings = verified
      ? ['Lieu choisi manuellement. Aucun calcul du juste milieu.', 'Allers à l’heure du rendez-vous et retours après la fin vérifiés. Horaires OpenStreetMap à confirmer auprès du lieu.', ...router.notes]
      : ['Ce lieu ne permet pas de vérifier l’aller et le retour de tout le groupe. Choisis un autre lieu ou un autre créneau.', ...(check.onDemandOnly ? [ON_DEMAND] : [])];
  } catch (cause) {
    result.progress = { stage: 'failed', completed: 0, total: 1 };
    result.recommendations = [];
    result.warnings = [failureMessage(cause, 'Les allers et retours n’ont pas pu être vérifiés. Réessaie.')];
  }
  await publish();
  return result;
}
