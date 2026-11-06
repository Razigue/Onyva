// Benchmark on the real IDFM snapshot: memory, loading, oneToAll and journeys for a ten-person scenario.
// Usage: pnpm engine:bench [snapshot.bin] [YYYY-MM-DD]
import { readdirSync, readFileSync } from 'node:fs';
import { cpus, totalmem } from 'node:os';
import { join } from 'node:path';
import { deserializeNetwork, TransitEngine } from '@onyva/transit-engine';

const dir = 'data/engine';
const file = process.argv[2] ?? join(dir, readdirSync(dir).filter(name => name.endsWith('.bin')).sort().at(-1)!);
const date = process.argv[3] ?? '2026-11-13';
const gc = (globalThis as { gc?: () => void }).gc;
const rss = () => { gc?.(); return Math.round(process.memoryUsage().rss / 1e6); };
const at = (time: string) => Date.parse(`${date}T${time}:00+01:00`) / 1000;
const stats = (values: number[]) => { const s = [...values].sort((a, b) => a - b); const q = (p: number) => s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)]!; return { median: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), max: +s[s.length - 1]!.toFixed(1), n: s.length }; };

const before = rss();
let t = performance.now();
const bytes = readFileSync(file);
const network = deserializeNetwork(bytes);
const engine = new TransitEngine(network);
const loadMs = performance.now() - t;
const afterLoad = rss();

// GTFS station names have no commune: among homonyms, keep the station with the most platforms.
const find = (name: string) => {
  let best = -1, platforms = -1;
  network.stationNames.forEach((value, index) => {
    const count = network.stationStopOffsets[index + 1]! - network.stationStopOffsets[index]!;
    if (value.toLowerCase() === name.toLowerCase() && count > platforms) { best = index; platforms = count; }
  });
  if (best < 0) throw new Error(`Station not found: ${name}`);
  return network.stationIds[best]!;
};
// Ten departures spread over the region and three meeting stations. Public station names only.
const origins = ['La Courneuve - 8 Mai 1945', 'Nation', 'Châtelet - Les Halles', 'Saint-Denis', 'Versailles Chantiers', 'Créteil - Préfecture', 'Cergy le Haut', 'Massy - Palaiseau', 'Marne-la-Vallée - Chessy', 'Pont de Sèvres'].map(find);
const meetings = ['Opéra', 'République', 'Bastille'].map(find);

t = performance.now();
engine.oneToAll({ origin: origins[0]!, arriveBy: at('20:00'), window: 60 });
const viewMs = performance.now() - t;
const afterView = rss();

const oneToAll: Record<string, { ms: ReturnType<typeof stats>; reached: number; departures: number }> = {};
for (const window of [2 * 3600, 4 * 3600]) {
  const times: number[] = []; let reached = 0, departures = 0;
  for (let rep = 0; rep < 3; rep++) for (const origin of origins) {
    const start = performance.now();
    const result = engine.oneToAll({ origin, arriveBy: at('20:00'), window });
    times.push(performance.now() - start); reached = Math.max(reached, result.durations.length); departures = Math.max(departures, result.departuresScanned);
  }
  oneToAll[`${window / 3600}h`] = { ms: stats(times), reached, departures };
}

const journeyTimes: number[] = [], batchTimes: number[] = [];
let none = 0;
for (let rep = 0; rep < 3; rep++) {
  const batch = performance.now();
  for (const meeting of meetings) for (const origin of origins) {
    for (const [direction, from, to, time] of [['arriveBy', origin, meeting, at('20:00')], ['departAfter', meeting, origin, at('22:30')]] as const) {
      const start = performance.now();
      if (engine.journey({ from, to, time, direction }).status !== 'ok') none++;
      journeyTimes.push(performance.now() - start);
    }
  }
  batchTimes.push(performance.now() - batch);
}

// Consistency: oneToAll durations against dedicated arrive-by searches on a sample.
const sample = engine.oneToAll({ origin: origins[1]!, arriveBy: at('20:00') }).durations.filter((_, i) => i % 997 === 0);
let mismatches = 0;
for (const entry of sample) {
  if (entry.stationId === origins[1]) continue;
  const result = engine.journey({ from: origins[1]!, to: entry.stationId, time: at('20:00'), direction: 'arriveBy' });
  if (result.status !== 'ok' || result.journey.departure !== entry.latestDeparture) mismatches++;
}

console.info(JSON.stringify({
  machine: { cpu: cpus()[0]?.model, cores: cpus().length, memoryGb: Math.round(totalmem() / 1e9), node: process.version, arch: process.arch },
  snapshot: { file, bytes: bytes.length, ...network.meta.stats }, date,
  memoryMb: { before, afterLoad, afterFirstDayView: afterView },
  loadMs: Math.round(loadMs), firstDayViewMs: Math.round(viewMs),
  oneToAll, journeys: { single: stats(journeyTimes), batchOf60: stats(batchTimes), withoutResult: none / 3 },
  consistency: { sampled: sample.length - 1, mismatches },
}, null, 2));
