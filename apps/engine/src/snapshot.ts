import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { EngineMeta } from '@onyva/shared/engine';
import { dayToIsoDate, deserializeNetwork } from '@onyva/transit-engine';
import type { NetworkMeta } from '@onyva/transit-engine';

export interface LoadedSnapshot { id: string; file: string; bytes: Uint8Array; meta: EngineMeta }

export const snapshotId = (meta: Pick<NetworkMeta, 'formatVersion' | 'feedSha256'>) => `${meta.formatVersion}-${meta.feedSha256.slice(0, 12)}`;

/** Copies the snapshot into shared memory, so that every thread reads one copy. */
export function shareSnapshot(source: Uint8Array, file = 'memory'): LoadedSnapshot {
  const bytes = new Uint8Array(new SharedArrayBuffer(source.byteLength));
  bytes.set(source);
  const meta = deserializeNetwork(bytes).meta;
  return {
    id: snapshotId(meta), file, bytes,
    meta: { snapshot: snapshotId(meta), feedSha256: meta.feedSha256, validFrom: dayToIsoDate(meta.validFromDay), validUntil: dayToIsoDate(meta.validUntilDay), builtAt: meta.builtAt, stations: meta.stats.stations, trips: meta.stats.trips },
  };
}

/** A file, or the most recently written `snapshot-*.bin` of a directory. */
export async function resolveSnapshotFile(path: string): Promise<string> {
  if (!(await stat(path)).isDirectory()) return path;
  const files = (await readdir(path)).filter(name => /^snapshot-.+\.bin$/.test(name));
  if (files.length === 0) throw new Error(`No snapshot in ${path}.`);
  const dated = await Promise.all(files.map(async name => ({ name, time: (await stat(join(path, name))).mtimeMs })));
  dated.sort((a, b) => b.time - a.time);
  return join(path, dated[0]!.name);
}

export async function loadSnapshot(path: string): Promise<LoadedSnapshot> {
  const file = await resolveSnapshotFile(path);
  return shareSnapshot(await readFile(file), file);
}
