// Compiles an unzipped IDFM GTFS directory into a binary snapshot for the transit engine.
// Usage: pnpm engine:build-network [gtfsDir] [outDir]
import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { compileNetwork, csvRows, serializeNetwork } from '@onyva/transit-engine';

const gtfsDir = process.argv[2] ?? 'data/gtfs-idfm/raw', outDir = process.argv[3] ?? 'data/engine';
const zip = join(gtfsDir, '..', 'IDFM-gtfs.zip');
// Opened lazily: a readline interface created before being read loses its lines.
const rows = (name: string) => ({ [Symbol.asyncIterator]: () => csvRows(createInterface({ input: createReadStream(join(gtfsDir, name)), crlfDelay: Infinity })) });
const optional = (name: string) => existsSync(join(gtfsDir, name)) ? rows(name) : [];

const started = performance.now();
const feedSha256 = existsSync(zip) ? createHash('sha256').update(await readFile(zip)).digest('hex') : createHash('sha256').update(await readFile(join(gtfsDir, 'stop_times.txt'))).digest('hex');
const network = await compileNetwork({
  stops: rows('stops.txt'), routes: rows('routes.txt'), trips: rows('trips.txt'), stopTimes: rows('stop_times.txt'),
  calendar: optional('calendar.txt'), calendarDates: optional('calendar_dates.txt'), transfers: optional('transfers.txt'),
}, { feedSha256 });
const compiled = performance.now();
const bytes = serializeNetwork(network), snapshot = `${network.meta.formatVersion}-${feedSha256.slice(0, 12)}`;
await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, `snapshot-${snapshot}.bin`), bytes);
await writeFile(join(outDir, `snapshot-${snapshot}.json`), JSON.stringify({ snapshot, ...network.meta }, null, 2) + '\n');
console.info(JSON.stringify({ snapshot, file: join(outDir, `snapshot-${snapshot}.bin`), bytes: bytes.length, compileMs: Math.round(compiled - started), totalMs: Math.round(performance.now() - started), heapMb: Math.round(process.memoryUsage().rss / 1e6), ...network.meta.stats, validFromDay: network.meta.validFromDay, validUntilDay: network.meta.validUntilDay }));
