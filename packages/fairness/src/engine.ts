import type { Journey, Leg, Venue } from '@onyva/shared';

/**
 * Turns a station-to-station journey of the transit engine into a journey to or from the venue.
 * The engine knows only stations: the final walk is the catalogue estimate of the venue (5 minutes at most),
 * added here so that no venue position ever reaches the engine.
 * `arrival`: the journey must reach the venue station by `requestedAt - walkSeconds`; it ends at `requestedAt`.
 * `departure`: the journey must leave the venue station after `requestedAt + walkSeconds`; it starts at `requestedAt`.
 * Any gap, overlap or late arrival fails closed.
 */
export function venueJourney(
  raw: Journey,
  venue: Pick<Venue, 'id' | 'name' | 'stationId' | 'walkSeconds'>,
  requestedAt: number,
  direction: 'arrival' | 'departure',
): Journey | null {
  const walk = venue.walkSeconds;
  if (!Number.isInteger(walk) || walk < 0 || walk > 300) return null;
  // Extra contract fields (GTFS route, stations passed) are kept out of the stored journey.
  const transit: Leg[] = raw.legs.map(({ from, to, departure, arrival, mode, line, fromName, toName, night }) => ({
    from, to, departure, arrival, mode,
    ...(line === undefined ? {} : { line }),
    ...(fromName === undefined ? {} : { fromName }),
    ...(toName === undefined ? {} : { toName }),
    ...(night === undefined ? {} : { night }),
  }));
  let previous: number | null = null;
  for (const leg of transit) {
    if (leg.arrival < leg.departure || (previous !== null && leg.departure !== previous)) return null;
    previous = leg.arrival;
  }
  if (transit.length && (transit[0]!.departure !== raw.departure || transit.at(-1)!.arrival !== raw.arrival)) return null;
  const station = venue.stationId;
  const stationName = transit.length ? (direction === 'arrival' ? transit.at(-1)!.toName : transit[0]!.fromName) : undefined;
  const stationNames = stationName === undefined ? {} : direction === 'arrival' ? { fromName: stationName } : { toName: stationName };
  const legs: Leg[] = [];
  if (direction === 'arrival') {
    // Same station: nothing to ride, only the walk.
    const reached = transit.length ? raw.arrival : requestedAt - walk;
    if (reached + walk > requestedAt) return null;
    legs.push(...transit);
    if (walk > 0) legs.push({ from: station, to: venue.id, ...stationNames, toName: venue.name, departure: reached, arrival: reached + walk, mode: 'walk' });
    if (reached + walk < requestedAt) legs.push({ from: venue.id, to: venue.id, fromName: venue.name, toName: venue.name, departure: reached + walk, arrival: requestedAt, mode: 'wait' });
    const departure = legs[0]?.departure ?? requestedAt;
    return { departure, arrival: requestedAt, duration: requestedAt - departure, legs, night: transit.some(leg => leg.night === true) };
  }
  const leaves = transit.length ? raw.departure : requestedAt + walk;
  if (leaves < requestedAt + walk) return null;
  if (walk > 0) legs.push({ from: venue.id, to: station, fromName: venue.name, ...stationNames, departure: requestedAt, arrival: requestedAt + walk, mode: 'walk' });
  if (leaves > requestedAt + walk) legs.push({ from: station, to: station, ...(stationName === undefined ? {} : { fromName: stationName, toName: stationName }), departure: requestedAt + walk, arrival: leaves, mode: 'wait' });
  legs.push(...transit);
  const arrival = legs.at(-1)?.arrival ?? requestedAt;
  return { departure: requestedAt, arrival, duration: arrival - requestedAt, legs, night: transit.some(leg => leg.night === true) };
}

/** Compact cache form of a oneToAll answer: `<suffix>:<seconds>` pairs, the catalogue prefix stripped. */
const PREFIX = 'stop_area:IDFM:';
export function packStationTimes(times: { stationId: string; duration: number }[]): string {
  return times.filter(time => time.stationId.startsWith(PREFIX)).map(time => `${time.stationId.slice(PREFIX.length)}:${time.duration}`).join(';');
}
export function unpackStationTimes(packed: string): { stationId: string; duration: number }[] {
  if (!packed) return [];
  return packed.split(';').map(entry => {
    const [suffix, seconds] = entry.split(':');
    const duration = Number(seconds);
    if (!suffix || !Number.isInteger(duration) || duration < 0) throw new Error('Cache des temps illisible.');
    return { stationId: PREFIX + suffix, duration };
  });
}
