import { recommendationLimits } from '@onyva/shared';
import type { Journey, Participant, Recommendation, Venue } from '@onyva/shared';
export * from './prim.ts';

export type JourneyPlanner = (from: string, to: string, time: number, direction: 'arriveBy' | 'departAfter') => Journey | null;

export function rankVenues(input: { participants: Participant[]; venues: Venue[]; startsAt: number; endsAt: number; kind: Venue['kind']; plan: JourneyPlanner }): Recommendation[] {
  const { participants, venues, startsAt, endsAt, kind } = input;
  const cache = new Map<string, Journey | null>();
  const plan: JourneyPlanner = (from, to, time, direction) => {
    const key = JSON.stringify([from, to, time, direction]);
    if (!cache.has(key)) cache.set(key, input.plan(from, to, time, direction));
    return cache.get(key) ?? null;
  };
  if (participants.length < 2 || participants.length > 10 || new Set(participants.map(p => p.id)).size !== participants.length || endsAt <= startsAt) return [];
  const results: Recommendation[] = [];
  // Evaluate nearby walks first so the request-local planner can reuse an
  // itinerary while its first vehicle remains reachable at later start times.
  for (const venue of [...venues].sort((a, b) => a.walkSeconds - b.walkSeconds)) {
    if (venue.kind !== kind || venue.walkSeconds > 300 || !venue.openIntervals.some(interval => interval.start <= startsAt && interval.end >= endsAt)) continue;
    const journeys: Recommendation['journeys'] = [];
    for (const person of participants) {
      const outbound = plan(person.departureId, venue.stationId, startsAt - venue.walkSeconds, 'arriveBy');
      const inbound = plan(venue.stationId, person.returnId, endsAt + venue.walkSeconds, 'departAfter');
      if (!outbound || !inbound) break;
      journeys.push({ participantId: person.id,
        outbound: { ...outbound, arrival: startsAt, duration: outbound.duration + venue.walkSeconds, legs: [...outbound.legs, { from: venue.stationId, to: venue.id, departure: startsAt - venue.walkSeconds, arrival: startsAt, mode: 'walk' }] },
        inbound: { ...inbound, departure: endsAt, duration: inbound.duration + venue.walkSeconds, legs: [{ from: venue.id, to: venue.stationId, departure: endsAt, arrival: endsAt + venue.walkSeconds, mode: 'walk' }, ...inbound.legs] },
      });
    }
    if (journeys.length !== participants.length) continue;
    const times = journeys.map(j => j.outbound.duration);
    const maximum = Math.max(...times);
    results.push({ venue, journeys, maximum, sum: times.reduce((a, b) => a + b, 0), spread: maximum - Math.min(...times) });
  }
  const compare = (a: Recommendation, b: Recommendation) => a.maximum - b.maximum || a.sum - b.sum || a.spread - b.spread || a.venue.id.localeCompare(b.venue.id);
  const ranked = results.sort(compare);
  const limit = recommendationLimits[kind];
  if (kind !== 'dinner' || ranked.length <= limit) return ranked.slice(0, limit);
  // Keep the minimax winner. Reserve alternatives for each documented cuisine,
  // choosing the fairest eligible venue each time, then fill remaining slots.
  const selected = new Set<Recommendation>();
  const covered = new Set<string>();
  const add = (result: Recommendation) => {
    selected.add(result);
    for (const cuisine of result.venue.cuisines ?? []) covered.add(cuisine);
  };
  add(ranked[0]!);
  for (const result of ranked) {
    if (selected.size >= limit) break;
    if (result.venue.cuisines?.some(cuisine => !covered.has(cuisine))) add(result);
  }
  for (const result of ranked) {
    if (selected.size >= limit) break;
    add(result);
  }
  return [...selected].sort(compare);
}
