import type { GtfsRow } from './csv.ts';
import { DROP_OFF_SHIFT, FORMAT_VERSION } from './network.ts';
import type { Network } from './network.ts';
import { gtfsDateToDay, parseGtfsTime } from './time.ts';

type Rows = AsyncIterable<GtfsRow> | Iterable<GtfsRow>;
export interface GtfsSource {
  stops: Rows; routes: Rows; trips: Rows; stopTimes: Rows; calendar: Rows; calendarDates: Rows; transfers: Rows;
}
export interface CompileOptions { feedSha256: string; builtAt?: string; defaultTransferSeconds?: number }

/** Catalog identifiers keep the format imported from PRIM: stop_area:IDFM:<n>. */
export const catalogStationId = (gtfsId: string) => `stop_area:${gtfsId}`;
/** Night buses (Noctilien) are N followed by a number. Rule to verify against IDFM line data. */
const isNightRoute = (shortName: string, type: number) => type === 3 && /^N\d/.test(shortName);

class IntBuffer {
  data = new Int32Array(1024); length = 0;
  push(value: number) {
    if (this.length === this.data.length) { const next = new Int32Array(this.data.length * 2); next.set(this.data); this.data = next; }
    this.data[this.length++] = value;
  }
  view() { return this.data.subarray(0, this.length); }
}

export async function compileNetwork(source: GtfsSource, options: CompileOptions): Promise<Network> {
  // Stations and platforms.
  const stationIndex = new Map<string, number>(), stationIds: string[] = [], stationNames: string[] = [], lat: number[] = [], lon: number[] = [];
  const platformRows: GtfsRow[] = [];
  for await (const row of source.stops) {
    const type = row.location_type || '0';
    if (type === '1') {
      stationIndex.set(row.stop_id!, stationIds.length);
      stationIds.push(catalogStationId(row.stop_id!)); stationNames.push(row.stop_name ?? ''); lat.push(Number(row.stop_lat)); lon.push(Number(row.stop_lon));
    } else if (type === '0') platformRows.push(row);
  }
  const stopIndex = new Map<string, number>(), stopStationList: number[] = [];
  for (const row of platformRows) {
    let station = row.parent_station ? stationIndex.get(row.parent_station) : undefined;
    if (station === undefined) {
      // A platform without a known parent becomes its own station.
      station = stationIds.length; stationIndex.set(row.stop_id!, station);
      stationIds.push(catalogStationId(row.stop_id!)); stationNames.push(row.stop_name ?? ''); lat.push(Number(row.stop_lat)); lon.push(Number(row.stop_lon));
    }
    stopIndex.set(row.stop_id!, stopStationList.length); stopStationList.push(station);
  }
  const stopCount = stopStationList.length, stationCount = stationIds.length;

  // Routes.
  const routeIndex = new Map<string, number>(), routeIds: string[] = [], routeNames: string[] = [], routeTypes: number[] = [], routeNight: number[] = [];
  for await (const row of source.routes) {
    routeIndex.set(row.route_id!, routeIds.length);
    const type = Number(row.route_type), name = row.route_short_name || row.route_long_name || '';
    routeIds.push(row.route_id!); routeNames.push(name); routeTypes.push(type); routeNight.push(isNightRoute(name, type) ? 1 : 0);
  }

  // Calendar resolved to one byte per service and day.
  const calendarRows: GtfsRow[] = [], dateRows: GtfsRow[] = [];
  let firstDay = Infinity, lastDay = -Infinity;
  for await (const row of source.calendar) { calendarRows.push(row); firstDay = Math.min(firstDay, gtfsDateToDay(row.start_date!)); lastDay = Math.max(lastDay, gtfsDateToDay(row.end_date!)); }
  for await (const row of source.calendarDates) { dateRows.push(row); const day = gtfsDateToDay(row.date!); firstDay = Math.min(firstDay, day); lastDay = Math.max(lastDay, day); }
  if (!Number.isFinite(firstDay)) throw new Error('The feed has no calendar.');
  const dayCount = lastDay - firstDay + 1, serviceIndex = new Map<string, number>();
  const serviceOf = (id: string) => { let index = serviceIndex.get(id); if (index === undefined) { index = serviceIndex.size; serviceIndex.set(id, index); } return index; };
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const activeDays: Array<Set<number>> = [];
  for (const row of calendarRows) {
    const index = serviceOf(row.service_id!), set = (activeDays[index] ??= new Set());
    for (let day = gtfsDateToDay(row.start_date!); day <= gtfsDateToDay(row.end_date!); day++) {
      // 1970-01-01 was a Thursday.
      const weekday = weekdays[(day + 3) % 7]!;
      if (row[weekday] === '1') set.add(day);
    }
  }
  for (const row of dateRows) {
    const index = serviceOf(row.service_id!), set = (activeDays[index] ??= new Set()), day = gtfsDateToDay(row.date!);
    if (row.exception_type === '1') set.add(day); else if (row.exception_type === '2') set.delete(day);
  }
  const serviceCount = serviceIndex.size, serviceDays = new Uint8Array(serviceCount * dayCount);
  activeDays.forEach((set, index) => { for (const day of set) serviceDays[index * dayCount + day - firstDay] = 1; });

  // Trips.
  const tripIndex = new Map<string, number>(), tripRoute: number[] = [], tripServiceList: number[] = [];
  for await (const row of source.trips) {
    const route = routeIndex.get(row.route_id!);
    if (route === undefined) continue;
    tripIndex.set(row.trip_id!, tripRoute.length); tripRoute.push(route); tripServiceList.push(serviceOf(row.service_id!));
  }
  const tripCount = tripRoute.length;

  // Stop times, buffered then grouped by trip with a counting sort.
  const stTrip = new IntBuffer(), stSeq = new IntBuffer(), stStop = new IntBuffer(), stArr = new IntBuffer(), stDep = new IntBuffer(), stFlags = new IntBuffer();
  const flexTrip = new Uint8Array(tripCount);
  let onDemandStopTimes = 0;
  for await (const row of source.stopTimes) {
    const trip = tripIndex.get(row.trip_id!), stop = stopIndex.get(row.stop_id!);
    if (trip === undefined) continue;
    const arrival = parseGtfsTime(row.arrival_time ?? ''), departure = parseGtfsTime(row.departure_time ?? '');
    // Flexible service windows have no fixed times: the whole trip is left out.
    if (stop === undefined || (arrival === null && departure === null) || row.start_pickup_drop_off_window) { flexTrip[trip] = 1; continue; }
    const pickup = Number(row.pickup_type || 0) & 3, dropOff = Number(row.drop_off_type || 0) & 3;
    if (pickup >= 2 || dropOff >= 2) onDemandStopTimes++;
    stTrip.push(trip); stSeq.push(Number(row.stop_sequence)); stStop.push(stop);
    stArr.push(arrival ?? departure!); stDep.push(departure ?? arrival!); stFlags.push(pickup | (dropOff << DROP_OFF_SHIFT));
  }
  const total = stTrip.length, counts = new Int32Array(tripCount + 1);
  for (let i = 0; i < total; i++) counts[stTrip.data[i]! + 1]!++;
  for (let t = 0; t < tripCount; t++) counts[t + 1]! += counts[t]!;
  const order = new Int32Array(total), cursor = counts.slice(0, tripCount);
  for (let i = 0; i < total; i++) { const t = stTrip.data[i]!; order[cursor[t]!++] = i; }

  // Group trips by route and stop sequence.
  const patternKey = new Map<string, number>(), patternTrips: number[][] = [], patternRouteList: number[] = [], patternStopLists: number[][] = [];
  let excludedFlexTrips = 0;
  for (let t = 0; t < tripCount; t++) {
    const from = counts[t]!, to = counts[t + 1]!;
    if (flexTrip[t]) { excludedFlexTrips++; continue; }
    if (to - from < 2) continue;
    const rows = Array.from(order.subarray(from, to)).sort((a, b) => stSeq.data[a]! - stSeq.data[b]!);
    order.set(rows, from);
    const stops = rows.map(i => stStop.data[i]!), key = `${tripRoute[t]}|${stops.join(',')}`;
    let pattern = patternKey.get(key);
    if (pattern === undefined) { pattern = patternTrips.length; patternKey.set(key, pattern); patternTrips.push([]); patternRouteList.push(tripRoute[t]!); patternStopLists.push(stops); }
    patternTrips[pattern]!.push(t);
  }

  // Sort trips by first departure and split lanes so that no trip overtakes another (RAPTOR FIFO property).
  const dep = (t: number, i: number) => stDep.data[order[counts[t]! + i]!]!, arr = (t: number, i: number) => stArr.data[order[counts[t]! + i]!]!;
  const lanes: Array<{ route: number; stops: number[]; trips: number[] }> = [];
  patternTrips.forEach((trips, p) => {
    const stops = patternStopLists[p]!, n = stops.length;
    trips.sort((a, b) => dep(a, 0) - dep(b, 0));
    const own: number[][] = [];
    for (const t of trips) {
      const lane = own.find(list => { const last = list[list.length - 1]!; for (let i = 0; i < n; i++) if (dep(t, i) < dep(last, i) || arr(t, i) < arr(last, i)) return false; return true; });
      if (lane) lane.push(t); else own.push([t]);
    }
    for (const list of own) lanes.push({ route: patternRouteList[p]!, stops, trips: list });
  });

  // Write pattern tables.
  const patternCount = lanes.length;
  const patternRoute = new Int32Array(patternCount), patternStopOffsets = new Int32Array(patternCount + 1), patternTripOffsets = new Int32Array(patternCount + 1), patternTimeOffsets = new Int32Array(patternCount + 1);
  lanes.forEach((lane, p) => {
    patternRoute[p] = lane.route;
    patternStopOffsets[p + 1] = patternStopOffsets[p]! + lane.stops.length;
    patternTripOffsets[p + 1] = patternTripOffsets[p]! + lane.trips.length;
    patternTimeOffsets[p + 1] = patternTimeOffsets[p]! + lane.stops.length * lane.trips.length;
  });
  const patternStops = new Int32Array(patternStopOffsets[patternCount]!), tripService = new Int32Array(patternTripOffsets[patternCount]!);
  const timeCount = patternTimeOffsets[patternCount]!, arrivals = new Int32Array(timeCount), departures = new Int32Array(timeCount), flags = new Uint8Array(timeCount);
  lanes.forEach((lane, p) => {
    patternStops.set(lane.stops, patternStopOffsets[p]!);
    const n = lane.stops.length;
    lane.trips.forEach((t, local) => {
      tripService[patternTripOffsets[p]! + local] = tripServiceList[t]!;
      const base = patternTimeOffsets[p]! + local * n;
      for (let i = 0; i < n; i++) {
        const row = order[counts[t]! + i]!;
        arrivals[base + i] = stArr.data[row]!; departures[base + i] = stDep.data[row]!; flags[base + i] = stFlags.data[row]!;
      }
    });
  });

  // Patterns serving each platform.
  const stopPatternOffsets = new Int32Array(stopCount + 1);
  for (let k = 0; k < patternStops.length; k++) stopPatternOffsets[patternStops[k]! + 1]!++;
  for (let s = 0; s < stopCount; s++) stopPatternOffsets[s + 1]! += stopPatternOffsets[s]!;
  const stopPatterns = new Int32Array(patternStops.length), stopPatternPositions = new Int32Array(patternStops.length), fill = stopPatternOffsets.slice(0, stopCount);
  for (let p = 0; p < patternCount; p++) {
    for (let k = patternStopOffsets[p]!; k < patternStopOffsets[p + 1]!; k++) {
      const s = patternStops[k]!, slot = fill[s]!++;
      stopPatterns[slot] = p; stopPatternPositions[slot] = k - patternStopOffsets[p]!;
    }
  }

  // Platforms of each station.
  const stationStopOffsets = new Int32Array(stationCount + 1);
  for (const station of stopStationList) stationStopOffsets[station + 1]!++;
  for (let s = 0; s < stationCount; s++) stationStopOffsets[s + 1]! += stationStopOffsets[s]!;
  const stationStops = new Int32Array(stopCount), stationFill = stationStopOffsets.slice(0, stationCount);
  stopStationList.forEach((station, stop) => { stationStops[stationFill[station]!++] = stop; });

  // Footpaths. Type 2 uses the minimum time; types 0 and 1 use it when present, otherwise a default.
  const pairs = new Map<number, number>();
  for await (const row of source.transfers) {
    const from = stopIndex.get(row.from_stop_id!), to = stopIndex.get(row.to_stop_id!), type = row.transfer_type || '0';
    if (from === undefined || to === undefined || from === to || !['0', '1', '2'].includes(type)) continue;
    const seconds = row.min_transfer_time ? Number(row.min_transfer_time) : (options.defaultTransferSeconds ?? 120);
    const key = from * stopCount + to, previous = pairs.get(key);
    if (previous === undefined || seconds < previous) pairs.set(key, seconds);
  }
  const outCounts = new Int32Array(stopCount + 1), inCounts = new Int32Array(stopCount + 1);
  for (const key of pairs.keys()) { outCounts[Math.floor(key / stopCount) + 1]!++; inCounts[(key % stopCount) + 1]!++; }
  for (let s = 0; s < stopCount; s++) { outCounts[s + 1]! += outCounts[s]!; inCounts[s + 1]! += inCounts[s]!; }
  const transferTo = new Int32Array(pairs.size), transferTime = new Int32Array(pairs.size), transferFrom = new Int32Array(pairs.size), transferInTime = new Int32Array(pairs.size);
  const outFill = outCounts.slice(0, stopCount), inFill = inCounts.slice(0, stopCount);
  for (const [key, seconds] of pairs) {
    const from = Math.floor(key / stopCount), to = key % stopCount;
    const o = outFill[from]!++; transferTo[o] = to; transferTime[o] = seconds;
    const i = inFill[to]!++; transferFrom[i] = from; transferInTime[i] = seconds;
  }

  // Validity: a published feed may keep a few trips of past days. A day counts only with at least half the median daily trips.
  const tripsPerService = new Int32Array(serviceCount); for (const s of tripService) tripsPerService[s]!++;
  const dailyTrips = Array.from({ length: dayCount }, (_, d) => { let count = 0; for (let s = 0; s < serviceCount; s++) if (serviceDays[s * dayCount + d]) count += tripsPerService[s]!; return count; });
  const running = dailyTrips.filter(count => count > 0).sort((a, b) => a - b), median = running[Math.floor(running.length / 2)] ?? 0;
  const full = dailyTrips.map((count, d) => (count > 0 && count >= median / 2 ? d : -1)).filter(d => d >= 0);
  if (!full.length) throw new Error('The feed has no active service.');
  const validFromDay = firstDay + full[0]!, validUntilDay = firstDay + full[full.length - 1]!;

  return {
    meta: {
      formatVersion: FORMAT_VERSION, feedSha256: options.feedSha256, builtAt: options.builtAt ?? new Date().toISOString(), firstDay, dayCount, validFromDay, validUntilDay,
      stats: { stations: stationCount, stops: stopCount, patterns: patternCount, trips: tripService.length, stopTimes: timeCount, excludedFlexTrips, onDemandStopTimes },
      dailyTrips,
    },
    stationIds, stationNames, stationLat: Float64Array.from(lat), stationLon: Float64Array.from(lon),
    stopStation: Int32Array.from(stopStationList), stationStopOffsets, stationStops,
    routeIds, routeNames, routeTypes: Int32Array.from(routeTypes), routeNight: Uint8Array.from(routeNight),
    patternRoute, patternStopOffsets, patternStops, patternTripOffsets, patternTimeOffsets, arrivals, departures, flags, tripService,
    stopPatternOffsets, stopPatterns, stopPatternPositions, serviceDays, serviceCount,
    transferOffsets: outCounts, transferTo, transferTime, transferInOffsets: inCounts, transferFrom, transferInTime,
  };
}
