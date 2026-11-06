// Compiled, immutable network. Every large table is a typed array so that the
// snapshot can be written to disk and shared between worker threads without copies.

export const FORMAT_VERSION = 1;

/** Pickup or drop-off value from GTFS, two bits each: 0 regular, 1 none, 2 phone, 3 driver. */
export const PICKUP_MASK = 0b0011;
export const DROP_OFF_SHIFT = 2;

export interface NetworkMeta {
  formatVersion: number;
  feedSha256: string;
  builtAt: string;
  /** Day number (days since 1970-01-01) of the first calendar day described by the feed. */
  firstDay: number;
  dayCount: number;
  /** First and last days with a full timetable: at least half the median daily trips. Past days kept by the publisher are left out. */
  validFromDay: number;
  validUntilDay: number;
  stats: { stations: number; stops: number; patterns: number; trips: number; stopTimes: number; excludedFlexTrips: number; onDemandStopTimes: number };
  /** Trips running on each calendar day, from firstDay. */
  dailyTrips: number[];
}

export interface Network {
  meta: NetworkMeta;
  stationIds: string[];
  stationNames: string[];
  stationLat: Float64Array;
  stationLon: Float64Array;
  /** Platform (GTFS location_type 0) to station index. */
  stopStation: Int32Array;
  /** CSR: platforms of each station. */
  stationStopOffsets: Int32Array;
  stationStops: Int32Array;
  routeIds: string[];
  routeNames: string[];
  routeTypes: Int32Array;
  routeNight: Uint8Array;
  /** Patterns: one RAPTOR route per GTFS route and stop sequence, trips sorted and never overtaking. */
  patternRoute: Int32Array;
  patternStopOffsets: Int32Array;
  patternStops: Int32Array;
  patternTripOffsets: Int32Array;
  /** Offset of each pattern block in arrival, departure and flags: trip-major, stop-minor. */
  patternTimeOffsets: Int32Array;
  arrivals: Int32Array;
  departures: Int32Array;
  flags: Uint8Array;
  tripService: Int32Array;
  /** CSR: patterns serving each platform, with the stop position inside the pattern. */
  stopPatternOffsets: Int32Array;
  stopPatterns: Int32Array;
  stopPatternPositions: Int32Array;
  serviceDays: Uint8Array;
  serviceCount: number;
  /** CSR outgoing and incoming footpaths between platforms, in seconds. */
  transferOffsets: Int32Array;
  transferTo: Int32Array;
  transferTime: Int32Array;
  transferInOffsets: Int32Array;
  transferFrom: Int32Array;
  transferInTime: Int32Array;
}
