import { DROP_OFF_SHIFT, PICKUP_MASK } from './network.ts';
import type { Network } from './network.ts';
import { dayToIsoDate, parisDay, serviceDayStart } from './time.ts';

const INF = 0x7fffffff, NEG = -0x7fffffff;

export interface EngineOptions {
  /** Maximum number of vehicles minus one. */
  maxTransfers?: number;
  /** Minimum time to change vehicle on the same platform, not described by transfers.txt. */
  sameStopTransferSeconds?: number;
  /** Longest journey considered, waits included. */
  maxJourneySeconds?: number;
}
export type Direction = 'arriveBy' | 'departAfter';
export interface EngineLeg {
  mode: 'walk' | 'wait' | 'transit';
  from: string; to: string; fromName: string; toName: string;
  departure: number; arrival: number;
  routeId?: string; line?: string; night?: boolean;
  /** Stations passed by a transit leg, boarding and alighting included. */
  stations?: string[];
}
export interface EngineJourney { departure: number; arrival: number; duration: number; transfers: number; night: boolean; legs: EngineLeg[] }
export type JourneyResult = { status: 'ok'; journey: EngineJourney } | { status: 'none'; reason: 'no-service' | 'on-demand-only' };
export interface OneToAllEntry { stationId: string; latestDeparture: number; duration: number; transfers: number }
export interface OneToAllResult { origin: string; arriveBy: number; durations: OneToAllEntry[]; unreachable: number; departuresScanned: number }

export class OutOfValidityError extends Error {
  constructor(readonly validFrom: string, readonly validUntil: string) { super(`Date outside the feed validity (${validFrom} to ${validUntil}).`); }
}
export class UnknownStationError extends Error {
  constructor(readonly stationId: string) { super(`Unknown station: ${stationId}`); }
}

interface DayView { anchor: number; tripStart: Int32Array; trips: Int32Array; offsets: Int32Array }

/** Per-round labels, reused between queries to avoid large allocations. */
class Labels {
  // a: vehicle label, b: walking label. board and alight are stop positions inside the pattern; walk is the other end of a footpath.
  readonly a: Int32Array[]; readonly b: Int32Array[]; readonly pattern: Int32Array[]; readonly view: Int32Array[];
  readonly board: Int32Array[]; readonly alight: Int32Array[]; readonly walk: Int32Array[];
  readonly bestA: Int32Array; readonly bestB: Int32Array;
  constructor(stops: number, rounds: number) {
    const make = () => Array.from({ length: rounds + 1 }, () => new Int32Array(stops));
    this.a = make(); this.b = make(); this.pattern = make(); this.view = make(); this.board = make(); this.alight = make(); this.walk = make();
    this.bestA = new Int32Array(stops); this.bestB = new Int32Array(stops);
  }
  reset(value: number) {
    for (const array of this.a) array.fill(value);
    for (const array of this.b) array.fill(value);
    this.bestA.fill(value); this.bestB.fill(value);
  }
}

export class TransitEngine {
  readonly maxTransfers: number; readonly sameStop: number; readonly maxJourney: number;
  private readonly rounds: number;
  private readonly stationLookup = new Map<string, number>();
  private readonly views = new Map<string, DayView>();
  private readonly labels: Labels;
  private readonly marked: Uint8Array; private readonly nextMarked: Uint8Array;
  private readonly markedList: Int32Array; private readonly nextList: Int32Array;
  private readonly patternFrom: Int32Array; private readonly patternList: Int32Array;
  private readonly stamp: Int32Array; private readonly improvedList: Int32Array; private stampValue = 0;

  constructor(readonly network: Network, options: EngineOptions = {}) {
    this.maxTransfers = options.maxTransfers ?? 8;
    this.sameStop = options.sameStopTransferSeconds ?? 60;
    this.maxJourney = options.maxJourneySeconds ?? 4 * 3600;
    this.rounds = this.maxTransfers + 1;
    network.stationIds.forEach((id, index) => this.stationLookup.set(id, index));
    const stops = network.stopStation.length, patterns = network.patternRoute.length;
    this.labels = new Labels(stops, this.rounds);
    this.marked = new Uint8Array(stops); this.nextMarked = new Uint8Array(stops);
    this.markedList = new Int32Array(stops); this.nextList = new Int32Array(stops);
    this.patternFrom = new Int32Array(patterns).fill(-1); this.patternList = new Int32Array(patterns);
    this.stamp = new Int32Array(stops); this.improvedList = new Int32Array(stops);
  }

  validity() { return { validFrom: dayToIsoDate(this.network.meta.validFromDay), validUntil: dayToIsoDate(this.network.meta.validUntilDay) }; }
  hasStation(id: string) { return this.stationLookup.has(id); }

  private station(id: string): number {
    const index = this.stationLookup.get(id);
    if (index === undefined) throw new UnknownStationError(id);
    return index;
  }
  private platforms(station: number) { return this.network.stationStops.subarray(this.network.stationStopOffsets[station]!, this.network.stationStopOffsets[station + 1]!); }

  /** Trips running on the service days around `epoch`, with times relative to one anchor. */
  private view(epoch: number): DayView {
    const meta = this.network.meta, day = parisDay(epoch);
    if (day < meta.validFromDay || day > meta.validUntilDay) { const v = this.validity(); throw new OutOfValidityError(v.validFrom, v.validUntil); }
    const key = String(day), cached = this.views.get(key);
    if (cached) return cached;
    const net = this.network, anchor = serviceDayStart(day - 1), patterns = net.patternRoute.length;
    const offsets = [0, 1, 2].map(k => serviceDayStart(day - 1 + k) - anchor);
    const tripStart = new Int32Array(patterns + 1), trips: number[] = [], offs: number[] = [];
    for (let p = 0; p < patterns; p++) {
      const first = net.patternTripOffsets[p]!, count = net.patternTripOffsets[p + 1]! - first, n = net.patternStopOffsets[p + 1]! - net.patternStopOffsets[p]!, base = net.patternTimeOffsets[p]!;
      const entries: Array<[number, number, number]> = [];
      for (let k = 0; k < 3; k++) {
        const index = day - 1 + k - meta.firstDay;
        if (index < 0 || index >= meta.dayCount) continue;
        for (let local = 0; local < count; local++) {
          if (net.serviceDays[net.tripService[first + local]! * meta.dayCount + index]) entries.push([local, offsets[k]!, net.departures[base + local * n]! + offsets[k]!]);
        }
      }
      entries.sort((x, y) => x[2] - y[2]);
      for (const [local, offset] of entries) { trips.push(local); offs.push(offset); }
      tripStart[p + 1] = trips.length;
    }
    const view = { anchor, tripStart, trips: Int32Array.from(trips), offsets: Int32Array.from(offs) };
    if (this.views.size >= 4) this.views.delete(this.views.keys().next().value!);
    this.views.set(key, view);
    return view;
  }

  private pickupOk(flag: number, onDemand: boolean) { const v = flag & PICKUP_MASK; return onDemand ? v !== 1 : v === 0; }

  private markStop(stop: number) { if (!this.nextMarked[stop]) { this.nextMarked[stop] = 1; this.nextList[this.nextCount++] = stop; } }
  private nextCount = 0; private markedCount = 0;
  /** Strict pruning bound of the running search, updated as targets are reached. */
  private bound = 0;
  private swapMarks() {
    for (let i = 0; i < this.markedCount; i++) this.marked[this.markedList[i]!] = 0;
    for (let i = 0; i < this.nextCount; i++) { const s = this.nextList[i]!; this.markedList[i] = s; this.marked[s] = 1; this.nextMarked[s] = 0; }
    this.markedCount = this.nextCount; this.nextCount = 0;
  }
  private clearMarks() { for (let i = 0; i < this.markedCount; i++) this.marked[this.markedList[i]!] = 0; for (let i = 0; i < this.nextCount; i++) this.nextMarked[this.nextList[i]!] = 0; this.markedCount = 0; this.nextCount = 0; }

  /**
   * Forward rounds. Labels: a = arrival by vehicle, b = arrival on foot (origin or footpath after a vehicle).
   * `bound(stop)` gives the strict upper limit for a useful label.
   */
  private forward(view: DayView, onDemand: boolean, onImprove?: (stop: number, round: number, time: number) => void) {
    const net = this.network, L = this.labels, arrivals = net.arrivals, departures = net.departures, flags = net.flags, sameStop = this.sameStop;
    for (let k = 1; k <= this.rounds && this.markedCount > 0; k++) {
      const prevA = L.a[k - 1]!, prevB = L.b[k - 1]!, A = L.a[k]!, B = L.b[k]!, P = L.pattern[k]!, V = L.view[k]!, BOARD = L.board[k]!, ALIGHT = L.alight[k]!, W = L.walk[k]!;
      let patternCount = 0;
      for (let m = 0; m < this.markedCount; m++) {
        const s = this.markedList[m]!;
        for (let j = net.stopPatternOffsets[s]!; j < net.stopPatternOffsets[s + 1]!; j++) {
          const p = net.stopPatterns[j]!, pos = net.stopPatternPositions[j]!;
          if (this.patternFrom[p] === -1) { this.patternList[patternCount++] = p; this.patternFrom[p] = pos; }
          else if (pos < this.patternFrom[p]!) this.patternFrom[p] = pos;
        }
      }
      const stamp = ++this.stampValue; let improvedCount = 0;
      for (let q = 0; q < patternCount; q++) {
        const p = this.patternList[q]!, start = this.patternFrom[p]!; this.patternFrom[p] = -1;
        const sBase = net.patternStopOffsets[p]!, n = net.patternStopOffsets[p + 1]! - sBase, tBase = net.patternTimeOffsets[p]!, vs = view.tripStart[p]!, ve = view.tripStart[p + 1]!;
        let cur = -1, board = -1;
        for (let i = start; i < n; i++) {
          const s = net.patternStops[sBase + i]!;
          if (cur >= 0) {
            const idx = tBase + view.trips[cur]! * n + i, drop = (flags[idx]! >> DROP_OFF_SHIFT) & PICKUP_MASK;
            if (drop === 0 || (onDemand && drop !== 1)) {
              const t = arrivals[idx]! + view.offsets[cur]!;
              if (t < L.bestA[s]! && t < this.bound) {
                if (this.stamp[s] !== stamp) { this.stamp[s] = stamp; this.improvedList[improvedCount++] = s; }
                A[s] = t; L.bestA[s] = t; P[s] = p; V[s] = cur; BOARD[s] = board; ALIGHT[s] = i;
                onImprove?.(s, k, t);
              }
            }
          }
          const pa = prevA[s]!, ready = pa === INF ? prevB[s]! : Math.min(pa + sameStop, prevB[s]!);
          if (ready === INF) continue;
          if (cur >= 0 && departures[tBase + view.trips[cur]! * n + i]! + view.offsets[cur]! < ready) continue;
          // Earliest trip leaving stop i at or after `ready`, assuming FIFO order.
          let lo = vs, hi = cur >= 0 ? cur + 1 : ve;
          while (lo < hi) { const mid = (lo + hi) >> 1; if (departures[tBase + view.trips[mid]! * n + i]! + view.offsets[mid]! < ready) lo = mid + 1; else hi = mid; }
          const end = cur >= 0 ? cur + 1 : ve;
          while (lo < end) { const pick = flags[tBase + view.trips[lo]! * n + i]! & PICKUP_MASK; if (pick === 0 || (onDemand && pick !== 1)) break; lo++; }
          if (lo < end && (cur < 0 || lo < cur)) { cur = lo; board = i; }
        }
      }
      // Footpaths after a vehicle, never two walks in a row.
      for (let m = 0; m < improvedCount; m++) {
        const s = this.improvedList[m]!;
        this.markStop(s);
        const arrival = A[s]!;
        for (let j = net.transferOffsets[s]!; j < net.transferOffsets[s + 1]!; j++) {
          const to = net.transferTo[j]!, t = arrival + net.transferTime[j]!;
          if (t < L.bestB[to]! && t < B[to]! && t < this.bound) { B[to] = t; L.bestB[to] = t; W[to] = s; this.markStop(to); onImprove?.(to, k, t); }
        }
      }
      this.swapMarks();
    }
    this.clearMarks();
  }

  /** Backward rounds. Labels: a = latest boarding of a vehicle, b = latest start of a walk towards a vehicle or the target. */
  private backward(view: DayView, onDemand: boolean, onImprove?: (stop: number, time: number) => void) {
    const net = this.network, L = this.labels, arrivals = net.arrivals, departures = net.departures, flags = net.flags, sameStop = this.sameStop;
    for (let k = 1; k <= this.rounds && this.markedCount > 0; k++) {
      const prevA = L.a[k - 1]!, prevB = L.b[k - 1]!, A = L.a[k]!, B = L.b[k]!, P = L.pattern[k]!, V = L.view[k]!, BOARD = L.board[k]!, ALIGHT = L.alight[k]!, W = L.walk[k]!;
      let patternCount = 0;
      for (let m = 0; m < this.markedCount; m++) {
        const s = this.markedList[m]!;
        for (let j = net.stopPatternOffsets[s]!; j < net.stopPatternOffsets[s + 1]!; j++) {
          const p = net.stopPatterns[j]!, pos = net.stopPatternPositions[j]!;
          if (this.patternFrom[p] === -1) { this.patternList[patternCount++] = p; this.patternFrom[p] = pos; }
          else if (pos > this.patternFrom[p]!) this.patternFrom[p] = pos;
        }
      }
      const stamp = ++this.stampValue; let improvedCount = 0;
      for (let q = 0; q < patternCount; q++) {
        const p = this.patternList[q]!, start = this.patternFrom[p]!; this.patternFrom[p] = -1;
        const sBase = net.patternStopOffsets[p]!, n = net.patternStopOffsets[p + 1]! - sBase, tBase = net.patternTimeOffsets[p]!, vs = view.tripStart[p]!, ve = view.tripStart[p + 1]!;
        let cur = -1, alight = -1;
        for (let i = start; i >= 0; i--) {
          const s = net.patternStops[sBase + i]!;
          if (cur >= 0) {
            const idx = tBase + view.trips[cur]! * n + i, pick = flags[idx]! & PICKUP_MASK;
            if (pick === 0 || (onDemand && pick !== 1)) {
              const t = departures[idx]! + view.offsets[cur]!;
              if (t > L.bestA[s]! && t > this.bound) {
                if (this.stamp[s] !== stamp) { this.stamp[s] = stamp; this.improvedList[improvedCount++] = s; }
                A[s] = t; L.bestA[s] = t; P[s] = p; V[s] = cur; BOARD[s] = i; ALIGHT[s] = alight;
                onImprove?.(s, t);
              }
            }
          }
          const pa = prevA[s]!, latest = pa === NEG ? prevB[s]! : Math.max(pa - sameStop, prevB[s]!);
          if (latest === NEG) continue;
          if (cur >= 0 && arrivals[tBase + view.trips[cur]! * n + i]! + view.offsets[cur]! > latest) continue;
          // Latest trip reaching stop i at or before `latest`.
          const begin = cur >= 0 ? cur : vs;
          let lo = begin, hi = ve;
          while (lo < hi) { const mid = (lo + hi) >> 1; if (arrivals[tBase + view.trips[mid]! * n + i]! + view.offsets[mid]! <= latest) lo = mid + 1; else hi = mid; }
          let candidate = lo - 1;
          while (candidate >= begin) { const drop = (flags[tBase + view.trips[candidate]! * n + i]! >> DROP_OFF_SHIFT) & PICKUP_MASK; if (drop === 0 || (onDemand && drop !== 1)) break; candidate--; }
          if (candidate >= begin && (cur < 0 || candidate > cur)) { cur = candidate; alight = i; }
        }
      }
      for (let m = 0; m < improvedCount; m++) {
        const s = this.improvedList[m]!;
        this.markStop(s);
        const departure = A[s]!;
        for (let j = net.transferInOffsets[s]!; j < net.transferInOffsets[s + 1]!; j++) {
          const from = net.transferFrom[j]!, t = departure - net.transferInTime[j]!;
          if (t > L.bestB[from]! && t > B[from]! && t > this.bound) { B[from] = t; L.bestB[from] = t; W[from] = s; this.markStop(from); onImprove?.(from, t); }
        }
      }
      this.swapMarks();
    }
    this.clearMarks();
  }

  journey(input: { from: string; to: string; time: number; direction: Direction }): JourneyResult {
    const regular = this.search(input, false);
    if (regular) return { status: 'ok', journey: regular };
    return this.search(input, true) ? { status: 'none', reason: 'on-demand-only' } : { status: 'none', reason: 'no-service' };
  }

  private search(input: { from: string; to: string; time: number; direction: Direction }, onDemand: boolean): EngineJourney | null {
    const origin = this.station(input.from), target = this.station(input.to), view = this.view(input.time), rel = input.time - view.anchor;
    const net = this.network, L = this.labels, targets = this.platforms(target), origins = this.platforms(origin);
    if (origin === target) return { departure: input.time, arrival: input.time, duration: 0, transfers: 0, night: false, legs: [] };
    if (input.direction === 'departAfter') {
      L.reset(INF);
      const isTarget = new Uint8Array(net.stopStation.length); for (const s of targets) isTarget[s] = 1;
      let best = rel + this.maxJourney + 1;
      for (const s of origins) { L.b[0]![s] = rel; L.bestB[s] = rel; L.walk[0]![s] = -1; this.markStop(s); }
      for (const s of origins) for (let j = net.transferOffsets[s]!; j < net.transferOffsets[s + 1]!; j++) {
        const to = net.transferTo[j]!, t = rel + net.transferTime[j]!;
        if (t < L.b[0]![to]!) { L.b[0]![to] = t; L.bestB[to] = t; L.walk[0]![to] = s; this.markStop(to); if (isTarget[to]) best = Math.min(best, t + 1); }
      }
      this.swapMarks();
      this.bound = best;
      this.forward(view, onDemand, (stop, _round, time) => { if (isTarget[stop] && time + 1 < this.bound) this.bound = time + 1; });
      let found: { k: number; stop: number; walk: boolean; time: number } | null = null;
      for (let k = 0; k <= this.rounds; k++) for (const s of targets) for (const walk of [false, true]) {
        const time = (walk ? L.b : L.a)[k]![s]!;
        if (time !== INF && (!found || time < found.time)) found = { k, stop: s, walk, time };
      }
      if (!found) return null;
      return this.buildForward(view, found.k, found.stop, found.walk);
    }
    L.reset(NEG);
    const isOrigin = new Uint8Array(net.stopStation.length); for (const s of origins) isOrigin[s] = 1;
    this.bound = rel - this.maxJourney - 1;
    const onImprove = (stop: number, time: number) => { if (isOrigin[stop] && time - 1 > this.bound) this.bound = time - 1; };
    for (const s of targets) { L.b[0]![s] = rel; L.bestB[s] = rel; L.walk[0]![s] = -1; this.markStop(s); }
    for (const s of targets) for (let j = net.transferInOffsets[s]!; j < net.transferInOffsets[s + 1]!; j++) {
      const from = net.transferFrom[j]!, t = rel - net.transferInTime[j]!;
      if (t > L.b[0]![from]!) { L.b[0]![from] = t; L.bestB[from] = t; L.walk[0]![from] = s; this.markStop(from); onImprove(from, t); }
    }
    this.swapMarks();
    this.backward(view, onDemand, onImprove);
    let found: { k: number; stop: number; walk: boolean; time: number } | null = null;
    for (let k = 0; k <= this.rounds; k++) for (const s of origins) for (const walk of [false, true]) {
      const time = (walk ? L.b : L.a)[k]![s]!;
      if (time !== NEG && (!found || time > found.time)) found = { k, stop: s, walk, time };
    }
    if (!found) return null;
    return this.buildBackward(view, found.k, found.stop, found.walk);
  }

  private stationOf(stop: number) { return this.network.stopStation[stop]!; }
  private transitLeg(view: DayView, p: number, cur: number, boardPos: number, alightPos: number): EngineLeg {
    const net = this.network, sBase = net.patternStopOffsets[p]!, n = net.patternStopOffsets[p + 1]! - sBase, idx = net.patternTimeOffsets[p]! + view.trips[cur]! * n, off = view.offsets[cur]!;
    const from = this.stationOf(net.patternStops[sBase + boardPos]!), to = this.stationOf(net.patternStops[sBase + alightPos]!), route = net.patternRoute[p]!;
    const stations: string[] = [];
    for (let i = boardPos; i <= alightPos; i++) { const id = net.stationIds[this.stationOf(net.patternStops[sBase + i]!)]!; if (stations[stations.length - 1] !== id) stations.push(id); }
    return {
      mode: 'transit', from: net.stationIds[from]!, to: net.stationIds[to]!, fromName: net.stationNames[from]!, toName: net.stationNames[to]!,
      departure: view.anchor + net.departures[idx + boardPos]! + off, arrival: view.anchor + net.arrivals[idx + alightPos]! + off,
      routeId: net.routeIds[route]!, line: net.routeNames[route]!, night: net.routeNight[route] === 1, stations,
    };
  }
  private walkLeg(fromStop: number, toStop: number, departure: number, seconds: number): EngineLeg {
    const net = this.network, from = this.stationOf(fromStop), to = this.stationOf(toStop);
    return { mode: 'walk', from: net.stationIds[from]!, to: net.stationIds[to]!, fromName: net.stationNames[from]!, toName: net.stationNames[to]!, departure, arrival: departure + seconds };
  }
  private transferSeconds(from: number, to: number) {
    const net = this.network;
    for (let j = net.transferOffsets[from]!; j < net.transferOffsets[from + 1]!; j++) if (net.transferTo[j] === to) return net.transferTime[j]!;
    throw new Error('Missing footpath during reconstruction.');
  }

  private buildForward(view: DayView, round: number, stop: number, walk: boolean): EngineJourney {
    const L = this.labels, net = this.network, legs: EngineLeg[] = [];
    let k = round, s = stop, onFoot = walk;
    for (let guard = 0; guard <= 2 * (this.rounds + 1); guard++) {
      if (onFoot) {
        const from = L.walk[k]![s]!;
        if (from === -1) break;
        const seconds = this.transferSeconds(from, s);
        legs.push(this.walkLeg(from, s, view.anchor + L.b[k]![s]! - seconds, seconds));
        s = from;
        if (k === 0) break;
        onFoot = false;
        continue;
      }
      const p = L.pattern[k]![s]!;
      legs.push(this.transitLeg(view, p, L.view[k]![s]!, L.board[k]![s]!, L.alight[k]![s]!));
      s = net.patternStops[net.patternStopOffsets[p]! + L.board[k]![s]!]!;
      k--;
      // How the boarding stop was reached in the previous round: walking wins ties.
      const byVehicle = L.a[k]![s]! === INF ? INF : L.a[k]![s]! + this.sameStop;
      onFoot = L.b[k]![s]! <= byVehicle;
    }
    return this.finish(legs.reverse());
  }

  private buildBackward(view: DayView, round: number, stop: number, walk: boolean): EngineJourney {
    const L = this.labels, net = this.network, legs: EngineLeg[] = [];
    let k = round, s = stop, onFoot = walk;
    for (let guard = 0; guard <= 2 * (this.rounds + 1); guard++) {
      if (onFoot) {
        const to = L.walk[k]![s]!;
        if (to === -1) break;
        const seconds = this.transferSeconds(s, to);
        legs.push(this.walkLeg(s, to, view.anchor + L.b[k]![s]!, seconds));
        s = to;
        if (k === 0) break;
        onFoot = false;
        continue;
      }
      const p = L.pattern[k]![s]!;
      legs.push(this.transitLeg(view, p, L.view[k]![s]!, L.board[k]![s]!, L.alight[k]![s]!));
      s = net.patternStops[net.patternStopOffsets[p]! + L.alight[k]![s]!]!;
      k--;
      const byVehicle = L.a[k]![s]! === NEG ? NEG : L.a[k]![s]! - this.sameStop;
      onFoot = L.b[k]![s]! >= byVehicle;
    }
    return this.finish(legs);
  }

  private finish(raw: EngineLeg[]): EngineJourney {
    const legs: EngineLeg[] = [];
    for (const leg of raw) {
      const previous = legs[legs.length - 1];
      if (previous && leg.departure > previous.arrival) legs.push({ mode: 'wait', from: leg.from, to: leg.from, fromName: leg.fromName, toName: leg.fromName, departure: previous.arrival, arrival: leg.departure });
      legs.push(leg);
    }
    const departure = legs[0]!.departure, arrival = legs[legs.length - 1]!.arrival, transit = legs.filter(leg => leg.mode === 'transit');
    return { departure, arrival, duration: arrival - departure, transfers: Math.max(0, transit.length - 1), night: transit.some(leg => leg.night), legs };
  }

  /**
   * For every station, the latest departure from `origin` that still arrives by `arriveBy`.
   * Range RAPTOR: departures from the origin are processed from the latest to the earliest, labels are kept between them.
   */
  oneToAll(input: { origin: string; arriveBy: number; window?: number; targets?: string[] }): OneToAllResult {
    const net = this.network, L = this.labels, origin = this.station(input.origin), window = Math.min(input.window ?? this.maxJourney, this.maxJourney);
    const view = this.view(input.arriveBy), T = input.arriveBy - view.anchor, earliest = T - window, origins = this.platforms(origin);
    const stations = net.stationIds.length, latest = new Int32Array(stations).fill(NEG), transfers = new Int32Array(stations);
    latest[origin] = T;
    // Walking only, from the origin platforms.
    for (const s of origins) for (let j = net.transferOffsets[s]!; j < net.transferOffsets[s + 1]!; j++) {
      const station = this.stationOf(net.transferTo[j]!), departure = T - net.transferTime[j]!;
      if (departure >= earliest && departure > latest[station]!) { latest[station] = departure; transfers[station] = 0; }
    }
    // Departure events: a vehicle leaving an origin platform, or a nearby platform reached on foot.
    // Each event marks only the platform it leaves from; labels are kept between events (range RAPTOR).
    const events = new Map<number, Array<[stop: number, walkFrom: number, walkSeconds: number]>>();
    const addEvents = (stop: number, walkFrom: number, walkSeconds: number) => {
      for (let j = net.stopPatternOffsets[stop]!; j < net.stopPatternOffsets[stop + 1]!; j++) {
        const p = net.stopPatterns[j]!, i = net.stopPatternPositions[j]!, n = net.patternStopOffsets[p + 1]! - net.patternStopOffsets[p]!, base = net.patternTimeOffsets[p]!;
        for (let v = view.tripStart[p]!; v < view.tripStart[p + 1]!; v++) {
          const idx = base + view.trips[v]! * n + i, leave = net.departures[idx]! + view.offsets[v]! - walkSeconds;
          if (leave >= earliest && leave <= T && this.pickupOk(net.flags[idx]!, false)) {
            const list = events.get(leave) ?? [];
            list.push([stop, walkFrom, walkSeconds]); events.set(leave, list);
          }
        }
      }
    };
    for (const s of origins) {
      addEvents(s, -1, 0);
      for (let j = net.transferOffsets[s]!; j < net.transferOffsets[s + 1]!; j++) addEvents(net.transferTo[j]!, s, net.transferTime[j]!);
    }
    const departures = [...events.keys()].sort((x, y) => y - x);
    L.reset(INF);
    let current = 0;
    const assign = (stop: number, round: number, time: number) => {
      if (time > T) return;
      const station = this.stationOf(stop);
      if (current > latest[station]!) { latest[station] = current; transfers[station] = Math.max(0, round - 1); }
    };
    for (const departure of departures) {
      current = departure;
      for (const [stop, walkFrom, walkSeconds] of events.get(departure)!) {
        const ready = departure + walkSeconds;
        if (ready < L.b[0]![stop]!) { L.b[0]![stop] = ready; L.bestB[stop] = Math.min(L.bestB[stop]!, ready); L.walk[0]![stop] = walkFrom; this.markStop(stop); }
      }
      this.swapMarks();
      this.bound = T + 1;
      this.forward(view, false, assign);
    }
    const wanted = input.targets ? input.targets.map(id => this.station(id)) : null;
    const durations: OneToAllEntry[] = [];
    let unreachable = 0;
    for (const station of wanted ?? Array.from({ length: stations }, (_, i) => i)) {
      const value = latest[station]!;
      if (value === NEG) { unreachable++; continue; }
      durations.push({ stationId: net.stationIds[station]!, latestDeparture: view.anchor + value, duration: T - value, transfers: transfers[station]! });
    }
    return { origin: input.origin, arriveBy: input.arriveBy, durations, unreachable, departuresScanned: departures.length };
  }
}
