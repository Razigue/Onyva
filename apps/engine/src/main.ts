// Entry point of the engine service. Configuration comes from the environment only, documented in .env.example.
// SIGHUP reloads the newest snapshot: the new pool is ready before it replaces the old one, which drains then stops.
import { availableParallelism } from 'node:os';
import { z } from 'zod';
import { ENGINE_LIMITS } from '@onyva/shared/engine';
import { EnginePool } from './pool.ts';
import { createEngineServer } from './server.ts';
import type { EngineState } from './server.ts';
import { loadSnapshot } from './snapshot.ts';

const config = z.object({
  ENGINE_SECRET: z.string().min(32, 'ENGINE_SECRET doit contenir au moins 32 caractères.'),
  ENGINE_HOST: z.string().default('127.0.0.1'),
  ENGINE_PORT: z.coerce.number().int().min(1).max(65_535).default(8787),
  ENGINE_SNAPSHOT: z.string().default('data/engine'),
  ENGINE_THREADS: z.coerce.number().int().min(1).max(64).default(Math.min(4, availableParallelism())),
  // Deadline per request, queue included. 5 s in production; a loaded development machine may need more.
  ENGINE_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(30_000).default(ENGINE_LIMITS.requestTimeoutMs),
}).parse(process.env);

let state: EngineState | null = null;
let reloading = false;

async function load() {
  const started = performance.now(), snapshot = await loadSnapshot(config.ENGINE_SNAPSHOT);
  if (state?.snapshot === snapshot.id) { console.info(JSON.stringify({ event: 'reload-skipped', snapshot: snapshot.id })); return; }
  const pool = new EnginePool(snapshot.bytes, { size: config.ENGINE_THREADS });
  try { await pool.ready(); } catch (error) { await pool.close().catch(() => undefined); throw error; }
  const previous = state;
  state = { snapshot: snapshot.id, meta: snapshot.meta, pool };
  console.info(JSON.stringify({ event: 'snapshot-loaded', snapshot: snapshot.id, validFrom: snapshot.meta.validFrom, validUntil: snapshot.meta.validUntil, threads: pool.size, ms: Math.round(performance.now() - started) }));
  await previous?.pool.close();
}

const server = createEngineServer({ secret: config.ENGINE_SECRET, state: () => state, requestTimeoutMs: config.ENGINE_TIMEOUT_MS });
server.listen(config.ENGINE_PORT, config.ENGINE_HOST, () => console.info(JSON.stringify({ event: 'listening', host: config.ENGINE_HOST, port: config.ENGINE_PORT })));
// /health answers 503 until the first snapshot is loaded.
await load();

process.on('SIGHUP', () => {
  if (reloading) return;
  reloading = true;
  // A failed reload keeps the previous snapshot in service.
  load().catch(error => console.error(JSON.stringify({ event: 'reload-failed', error: error instanceof Error ? error.message : 'unknown' }))).finally(() => { reloading = false; });
});
const stop = () => {
  server.close();
  void (state?.pool.close() ?? Promise.resolve()).finally(() => process.exit(0));
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
