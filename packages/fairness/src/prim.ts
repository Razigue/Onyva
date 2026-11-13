import { primDateTime, primJourneysSchema } from '@onyva/shared';
import type { Journey, Participant, PrimJourneys, Recommendation, Venue } from '@onyva/shared';

export type StationTimes = { stationId: string; duration: number }[];
export type StationScore = {
  stationId: string;
  maximum: number;
  sum: number;
  spread: number;
  times: { participantId: string; duration: number }[];
};
export const compareScores = (
  a: { maximum: number; sum: number; spread: number },
  b: { maximum: number; sum: number; spread: number },
) => a.maximum - b.maximum || a.sum - b.sum || a.spread - b.spread;

/** Navitia's single-origin /journeys mode is a tabular isochrone, not polygons. */
export function readIsochrone(raw: unknown): StationTimes {
  const response = primJourneysSchema.parse(raw);
  if (response.error) throw new Error('Isochrone indisponible.');
  if (response.pagination && response.pagination.total_result > response.pagination.items_on_page) {
    throw new Error('Isochrone incomplet.');
  }
  // PRIM returned exactly 1 000 entries without pagination even for count=20000.
  if (response.journeys.length >= 1000) throw new Error('Isochrone incomplet.');
  const times = new Map<string, number>();
  for (const journey of response.journeys) {
    if (journey.status === 'NO_SERVICE') continue;
    const destination = journey.to;
    if (destination?.stop_point && !destination.stop_point.stop_area) {
      throw new Error('Isochrone sans station parente.');
    }
    const id = destination?.stop_area?.id ?? destination?.stop_point?.stop_area?.id ??
      destination?.id;
    if (id && (!times.has(id) || journey.duration < times.get(id)!)) {
      times.set(id, journey.duration);
    }
  }
  return [...times].map(([stationId, duration]) => ({ stationId, duration }));
}

export function rankStations(
  inputs: { participantId: string; times: StationTimes }[],
): StationScore[] {
  if (
    inputs.length < 2 || inputs.length > 10 ||
    new Set(inputs.map((p) => p.participantId)).size !== inputs.length
  ) return [];
  const lookups = inputs.map((input) =>
    new Map(input.times.map((value) => [value.stationId, value.duration]))
  );
  return [...lookups[0]!.keys()].flatMap((stationId) => {
    const times = inputs.map((input, index) => ({
      participantId: input.participantId,
      duration: lookups[index]!.get(stationId),
    }));
    if (
      times.some((time) =>
        time.duration === undefined || !Number.isFinite(time.duration) || time.duration < 0
      )
    ) return [];
    const known = times as { participantId: string; duration: number }[];
    const maximum = Math.max(...known.map((time) => time.duration));
    return [{
      stationId,
      maximum,
      sum: known.reduce((sum, time) => sum + time.duration, 0),
      spread: maximum - Math.min(...known.map((time) => time.duration)),
      times: known,
    }];
  }).sort((a, b) => compareScores(a, b) || a.stationId.localeCompare(b.stationId));
}

/**
 * Up to `count` venues on distinct stations, in the station minimax order, so that the group compares real alternatives.
 * The closest venue of the best station always comes first. For dinner, a venue with a new cuisine is preferred at each station.
 * When fewer stations have an eligible venue, the remaining places go to other venues of the best stations.
 */
export function shortlistVenues(
  stations: StationScore[],
  venues: Venue[],
  startsAt: number,
  endsAt: number,
  kind: Venue['kind'],
  count = 3,
): Venue[] {
  const byStation = new Map<string, Venue[]>();
  for (const venue of venues) {
    if (
      venue.kind !== kind || venue.walkSeconds > 300 ||
      !venue.openIntervals.some((interval) => interval.start <= startsAt && interval.end >= endsAt)
    ) continue;
    byStation.set(venue.stationId, [...byStation.get(venue.stationId) ?? [], venue]);
  }
  const ordered = [...new Set(stations.map((station) => station.stationId))]
    .flatMap((id) => byStation.has(id) ? [byStation.get(id)!.sort((a, b) => a.walkSeconds - b.walkSeconds || a.id.localeCompare(b.id))] : []);
  const selected: Venue[] = [], cuisines = new Set<string>();
  const pick = (list: Venue[]) => {
    const free = list.filter((venue) => !selected.includes(venue));
    const choice = kind === 'dinner' && selected.length
      ? free.find((venue) => venue.cuisines?.some((cuisine) => !cuisines.has(cuisine))) ?? free[0]
      : free[0];
    if (!choice) return false;
    selected.push(choice);
    for (const cuisine of choice.cuisines ?? []) cuisines.add(cuisine);
    return true;
  };
  for (const list of ordered) {
    if (selected.length >= count) break;
    pick(list);
  }
  for (const list of ordered) while (selected.length < count && pick(list));
  return selected;
}

/** Full point-to-point verification. Missing sections, prohibited modes and gaps fail closed. */
export function readJourney(
  raw: PrimJourneys,
  requestedAt: number,
  direction: 'arrival' | 'departure',
): Journey | null {
  if (raw.error) return null;
  const candidates: Journey[] = [];
  for (const item of raw.journeys) {
    if (item.status === 'NO_SERVICE' || !item.sections?.length) continue;
    if (item.status && item.sections.some(section => section.type === 'public_transport' && section.data_freshness !== 'realtime')) continue;
    const departure = primDateTime(item.departure_date_time),
      arrival = primDateTime(item.arrival_date_time);
    if (
      departure === null || arrival === null || arrival < departure ||
      (direction === 'arrival' ? arrival > requestedAt : departure < requestedAt)
    ) continue;
    const legs: Journey['legs'] = [];
    let valid = true, previous = departure;
    for (const section of item.sections) {
      const start = primDateTime(section.departure_date_time),
        end = primDateTime(section.arrival_date_time);
      if (
        start === null || end === null || end < start || start < previous ||
        ![
          'public_transport',
          'street_network',
          'crow_fly',
          'walking',
          'waiting',
          'transfer',
          'boarding',
          'landing',
        ].includes(section.type) || (section.mode && section.mode !== 'walking') ||
        (section.type === 'crow_fly' && (section.mode !== 'walking' || end !== start)) ||
        section.type === 'on_demand_transport'
      ) {
        valid = false;
        break;
      }
      const from = section.from?.id ?? legs.at(-1)?.to ?? item.from?.id ?? 'station';
      const to = section.to?.id ?? from;
      if (start > previous) {
        legs.push({ from, to: from, departure: previous, arrival: start, mode: 'wait' });
      }
      const line = section.display_informations?.code ?? section.display_informations?.name;
      const night = section.type === 'public_transport' &&
        (/^N\d/.test(line ?? '') || /noctilien/i.test(section.display_informations?.network ?? ''));
      legs.push({
        from,
        to,
        fromName: section.from?.name,
        toName: section.to?.name,
        departure: start,
        arrival: end,
        mode: section.type === 'public_transport'
          ? 'transit'
          : ['waiting', 'boarding', 'landing'].includes(section.type)
          ? 'wait'
          : 'walk',
        line,
        night,
      });
      previous = end;
    }
    if (!valid || previous !== arrival) continue;
    const first = legs[0]!;
    if (first.departure !== departure) continue;
    if (direction === 'arrival' && arrival < requestedAt) {
      legs.push({
        from: legs.at(-1)!.to,
        to: legs.at(-1)!.to,
        departure: arrival,
        arrival: requestedAt,
        mode: 'wait',
      });
    }
    if (direction === 'departure' && departure > requestedAt) {
      legs.unshift({
        from: first.from,
        to: first.from,
        departure: requestedAt,
        arrival: departure,
        mode: 'wait',
      });
    }
    const start = direction === 'arrival' ? departure : requestedAt,
      end = direction === 'arrival' ? requestedAt : arrival;
    candidates.push({
      departure: start,
      arrival: end,
      duration: end - start,
      legs,
      night: legs.some((leg) => leg.night),
    });
  }
  return candidates.sort((a, b) => a.duration - b.duration)[0] ?? null;
}

export function verifiedRecommendation(
  venue: Venue,
  participants: Participant[],
  journeys: Recommendation['journeys'],
): Recommendation | null {
  if (
    participants.length < 2 || journeys.length !== participants.length ||
    new Set(journeys.map((j) => j.participantId)).size !== participants.length ||
    participants.some((p) => !journeys.some((j) => j.participantId === p.id))
  ) return null;
  // Coordinates in the detailed PRIM request include the real final walking section.
  if (
    journeys.some((j) => {
      const finalWalk = [...j.outbound.legs].reverse().filter((leg, index, all) =>
        leg.mode === 'walk' && !all.slice(0, index).some((previous) => previous.mode === 'transit')
      ).reduce((seconds, leg) => seconds + leg.arrival - leg.departure, 0);
      return finalWalk > 300;
    })
  ) return null;
  const times = journeys.map((j) => j.outbound.duration), maximum = Math.max(...times);
  return {
    venue,
    journeys,
    maximum,
    sum: times.reduce((sum, time) => sum + time, 0),
    spread: maximum - Math.min(...times),
  };
}
