// HTTP benchmark of a running engine service, real IDFM snapshot: ten one-to-all in parallel, then a batch of 60 journeys.
// Usage: ENGINE_URL=http://127.0.0.1:8787 ENGINE_SECRET=... pnpm engine:bench-http [YYYY-MM-DD]
// Public stations, looked up by name in the newest local snapshot, which must be the one the service loaded.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { journeysResponseSchema, oneToAllResponseSchema } from '@onyva/shared/engine';
import { deserializeNetwork } from '@onyva/transit-engine';

const url = process.env.ENGINE_URL ?? 'http://127.0.0.1:8787', secret = process.env.ENGINE_SECRET;
if (!secret) throw new Error('ENGINE_SECRET requis.');
const date = process.argv[2] ?? '2026-11-13';
const at = (time: string) => Date.parse(`${date}T${time}:00+01:00`) / 1000;
const dir = 'data/engine', network = deserializeNetwork(readFileSync(join(dir, readdirSync(dir).filter(name => name.endsWith('.bin')).sort((a, b) => statSync(join(dir, b)).mtimeMs - statSync(join(dir, a)).mtimeMs)[0]!)));
const find = (name: string) => {
  let best = -1, platforms = -1;
  network.stationNames.forEach((value, index) => {
    const count = network.stationStopOffsets[index + 1]! - network.stationStopOffsets[index]!;
    if (value.toLowerCase() === name.toLowerCase() && count > platforms) { best = index; platforms = count; }
  });
  if (best < 0) throw new Error(`Station introuvable : ${name}`);
  return network.stationIds[best]!;
};
const origins = ['La Courneuve - 8 Mai 1945', 'Nation', 'Châtelet - Les Halles', 'Saint-Denis', 'Versailles Chantiers', 'Créteil - Préfecture', 'Cergy le Haut', 'Massy - Palaiseau', 'Marne-la-Vallée - Chessy', 'Pont de Sèvres'].map(find);
const meetings = ['Opéra', 'République', 'Bastille'].map(find);
const headers = { authorization: `Bearer ${secret}`, 'content-type': 'application/json', 'accept-encoding': 'gzip' };
const post = async (path: string, body: unknown) => {
  const response = await fetch(`${url}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`${path} : ${response.status} ${await response.text()}`);
  return response.json() as Promise<unknown>;
};
const stats = (values: number[]) => { const s = [...values].sort((a, b) => a - b); return { min: Math.round(s[0]!), median: Math.round(s[Math.floor(s.length / 2)]!), max: Math.round(s.at(-1)!), n: s.length }; };

const groups: number[] = [], batches: number[] = [];
let reached = 0, none = 0;
for (let rep = 0; rep < 5; rep++) {
  // A different meeting time each round, so that no answer comes from a warm label state only.
  const arriveBy = at(['19:00', '19:30', '20:00', '20:30', '21:00'][rep]!);
  let t = performance.now();
  const results = await Promise.all(origins.map(origin => post('/v1/one-to-all', { origin, arriveBy })));
  groups.push(performance.now() - t);
  reached = Math.max(reached, ...results.map(result => oneToAllResponseSchema.parse(result).durations.length));
  const items = meetings.flatMap((meeting, m) => origins.flatMap((origin, o) => [
    { key: `a-${m}-${o}`, from: origin, to: meeting, time: arriveBy, direction: 'arriveBy' as const },
    { key: `r-${m}-${o}`, from: meeting, to: origin, time: arriveBy + 2.5 * 3600, direction: 'departAfter' as const },
  ]));
  t = performance.now();
  const batch = journeysResponseSchema.parse(await post('/v1/journeys', { items }));
  batches.push(performance.now() - t);
  none += batch.results.filter(result => result.status !== 'ok').length;
}
console.info(JSON.stringify({ url, date, oneToAllTenInParallelMs: stats(groups), stationsReachedMax: reached, journeysBatchOf60Ms: stats(batches), journeysWithoutResult: none }, null, 2));
