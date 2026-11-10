// SYNTHETIC DEMONSTRATION DATA, for the development preview of the results screen only (app/preview/results.tsx).
// Every name, time and venue below is invented. Station names are public, but no duration comes from a real
// computation. Never shown in a release build, never sent to the backend.
import type { Journey, Leg, Outing, Recommendation, RecommendationResponse, Station, Venue } from '@onyva/shared';

export const SAMPLE_NOTICE = 'Données de démonstration inventées. Aucun trajet réel, rien n’est enregistré.';

const start = Date.parse('2026-11-20T19:30:00Z'), end = start + 150 * 60_000;
const iso = (ms: number) => new Date(ms).toISOString();

export const sampleStations: Station[] = [
  { id: 'stop_area:IDFM:71673', name: 'Nation', latitude: 48.8483, longitude: 2.3959, lines: ['1', '2', '6', '9', 'A'] },
  { id: 'stop_area:IDFM:72323', name: 'Saint-Denis', latitude: 48.9356, longitude: 2.3412, lines: ['D', 'H'] },
  { id: 'stop_area:IDFM:70698', name: 'Pont de Sèvres', latitude: 48.8297, longitude: 2.2306, lines: ['9'] },
  { id: 'stop_area:IDFM:70021', name: 'Créteil - Préfecture', latitude: 48.7797, longitude: 2.4591, lines: ['8'] },
  { id: 'stop_area:IDFM:71311', name: 'République', latitude: 48.8674, longitude: 2.3636, lines: ['3', '5', '8', '9', '11'] },
  { id: 'stop_area:IDFM:71337', name: 'Opéra', latitude: 48.8711, longitude: 2.3317, lines: ['3', '7', '8'] },
];
const station = (name: string) => sampleStations.find(s => s.name === name)!;

export const sampleOuting: Outing = {
  id: '00000000-0000-4000-8000-00000000d001', ownerId: '00000000-0000-4000-8000-00000000d0a1', inviteCode: '00000000-0000-4000-8000-00000000d002', shortCode: 'EXEMPL23',
  startsAt: iso(start), endsAt: iso(end), activity: 'drinks', confirmedVenueId: null, selectedVenue: null, updatedAt: iso(start - 86400_000), mode: 'live',
  participants: [
    { id: 'sample-alex', userId: '00000000-0000-4000-8000-00000000d0a1', name: 'Alex', departureId: station('Nation').id, returnId: station('Nation').id },
    { id: 'sample-ines', userId: null, name: 'Inès', departureId: station('Saint-Denis').id, returnId: station('Saint-Denis').id },
    { id: 'sample-noe', userId: null, name: 'Noé', departureId: station('Pont de Sèvres').id, returnId: station('Pont de Sèvres').id },
    { id: 'sample-sam', userId: null, name: 'Sam', departureId: station('Créteil - Préfecture').id, returnId: station('Créteil - Préfecture').id },
  ],
};

const venue = (n: number, name: string, at: string, walk: number, latitude: number, longitude: number): Venue => ({
  id: `sample:${n}`, name, stationId: station(at).id, neighborhood: at, kind: 'drinks', walkSeconds: walk, latitude, longitude, openIntervals: [{ start: start - 3600_000, end: end + 3600_000 }], source: 'osm',
});
const venues = [
  venue(1, 'Le Comptoir de démonstration', 'République', 180, 48.8679, 2.3641),
  venue(2, 'Café fictif du canal', 'République', 240, 48.8691, 2.3655),
  venue(3, 'Bar d’exemple', 'Opéra', 210, 48.8718, 2.3326),
];

/** A plausible itinerary shape: walk, wait, one or two lines, walk to the venue. Durations in minutes. */
function journey(from: Station, to: Venue, minutes: number, lines: string[], outbound: boolean): Journey {
  const total = minutes * 60, departure = outbound ? start - total : end + 10 * 60, arrival = departure + total;
  const ride = (total - 360) / lines.length, legs: Leg[] = [{ mode: 'walk', from: from.id, to: from.id, fromName: from.name, toName: from.name, departure, arrival: departure + 180 }];
  let cursor = departure + 180;
  lines.forEach((line, i) => {
    legs.push({ mode: 'wait', from: from.id, to: from.id, departure: cursor, arrival: cursor + 60 }); cursor += 60;
    legs.push({ mode: 'transit', line, from: i ? to.stationId : from.id, to: to.stationId, fromName: i ? 'Correspondance' : from.name, toName: station(to.neighborhood).name, departure: cursor, arrival: cursor + ride - 60 }); cursor += ride - 60;
  });
  legs.push({ mode: 'walk', from: to.stationId, to: to.id, toName: to.name, departure: cursor, arrival });
  const ordered = outbound ? legs : legs.map(leg => ({ ...leg }));
  return { departure, arrival, duration: total, legs: ordered, night: !outbound && minutes > 40 };
}

const plans: Array<{ venue: Venue; minutes: number[]; lines: string[][] }> = [
  { venue: venues[0]!, minutes: [12, 24, 26, 25], lines: [['9'], ['D', '5'], ['9'], ['8']] },
  { venue: venues[1]!, minutes: [14, 25, 28, 27], lines: [['5'], ['D', '5'], ['9'], ['8']] },
  { venue: venues[2]!, minutes: [21, 22, 20, 31], lines: [['9'], ['13'], ['9'], ['8']] },
];

export const sampleRecommendations: Recommendation[] = plans.map(plan => {
  const durations = plan.minutes.map(m => m * 60);
  return {
    venue: plan.venue, maximum: Math.max(...durations), sum: durations.reduce((a, b) => a + b, 0), spread: Math.max(...durations) - Math.min(...durations),
    journeys: sampleOuting.participants.map((person, i) => {
      const from = sampleStations.find(s => s.id === person.departureId)!;
      return { participantId: person.id, outbound: journey(from, plan.venue, plan.minutes[i]!, plan.lines[i]!, true), inbound: journey(from, plan.venue, plan.minutes[i]! + 4, plan.lines[i]!, false) };
    }),
  };
});

const candidate = { stationId: station('République').id, maximum: 25 * 60, sum: 86 * 60, spread: 13 * 60, times: sampleOuting.participants.map((p, i) => ({ participantId: p.id, duration: [12, 24, 25, 25][i]! * 60 })) };

/** Progressive answers as the backend sends them: comparison, then return checks, then the result. Offsets in ms. */
export function sampleTimeline(): Array<{ after: number; response: RecommendationResponse }> {
  const computedAt = iso(start - 3 * 3600_000), base = { computedAt, source: 'gtfs' as const, warnings: [SAMPLE_NOTICE], recommendations: [] as Recommendation[] };
  const steps: Array<{ after: number; response: RecommendationResponse }> = [];
  for (let i = 0; i <= 4; i++) steps.push({ after: i * 450, response: { ...base, progress: { stage: 'isochrones', completed: i, total: 4 }, ...(i === 4 ? { stationCandidates: [candidate] } : {}) } });
  for (let i = 0; i <= 6; i += 2) steps.push({ after: 2000 + i * 300, response: { ...base, progress: { stage: 'returns', completed: i, total: 6 }, stationCandidates: [candidate] } });
  steps.push({ after: 4200, response: { ...base, progress: { stage: 'complete', completed: 6, total: 6 }, recommendations: sampleRecommendations } });
  return steps;
}
