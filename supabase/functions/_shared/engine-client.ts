import { z } from 'zod';
import {
  engineErrorSchema,
  engineMetaSchema,
  journeysResponseSchema,
  oneToAllResponseSchema,
} from '../../../packages/shared/src/engine.ts';
import type { EngineMeta, JourneysRequest, JourneysResponse } from '../../../packages/shared/src/engine.ts';
import { packStationTimes, unpackStationTimes } from '../../../packages/fairness/src/engine.ts';
import type { StationTimes } from '../../../packages/fairness/src/prim.ts';

/** An error whose message can be shown to the group as is. */
export class TransitError extends Error {}

/** `concurrency`: isochrones sent at once, the engine thread count. Beyond it they wait in the engine queue, whose time counts in its 5 s deadline. */
export type EngineConfig = { url: string; secret: string; concurrency?: number; timeoutMs?: number };
/** Same short cache as PRIM, linked to the outing and deleted with it. */
export type EngineCache = {
  claim: (key: string) => Promise<unknown>;
  save: (key: string, payload: unknown, ttl: number) => Promise<void>;
};

/** HTTPS only, except for a service on the same machine during development. */
const bounded = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
};
/** `threads` and `timeoutMs` mirror ENGINE_THREADS and ENGINE_TIMEOUT_MS of the engine service. */
export function engineConfig(url: string | undefined, secret: string | undefined, threads?: string, timeoutMs?: string): EngineConfig | null {
  if (!url || !secret || secret.length < 32) return null;
  const concurrency = bounded(threads, 4, 1, 64), timeout = bounded(timeoutMs, 5_000, 1_000, 30_000);
  try {
    const parsed = new URL(url);
    const local = ['localhost', '127.0.0.1', 'host.docker.internal'].includes(parsed.hostname);
    if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) return null;
    return { url: parsed.origin, secret, concurrency, timeoutMs: timeout };
  } catch {
    return null;
  }
}

const cacheStateSchema = z.object({ state: z.enum(['ready', 'pending', 'claimed']), payload: z.unknown().optional() });
const cachedTimesSchema = z.object({ snapshot: z.string(), times: z.string() });
const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'long' }).format(new Date(`${iso}T00:00:00Z`));

export function createEngineClient(config: EngineConfig, cache: EngineCache | null, send: typeof fetch = fetch) {
  const limit = Math.max(1, config.concurrency ?? 4);
  let active = 0;
  const waiting: (() => void)[] = [];
  async function limited<T>(work: () => Promise<T>): Promise<T> {
    if (active >= limit) await new Promise<void>(resolve => waiting.push(resolve));
    else active++;
    try {
      return await work();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  }
  // The engine answers 504 at its own deadline: wait a little longer to read that answer.
  async function call<T>(path: string, schema: z.ZodType<T>, body?: unknown, timeout = (config.timeoutMs ?? 5_000) + 3_000): Promise<T> {
    let response: Response;
    try {
      response = await send(new URL(path, config.url), {
        method: body === undefined ? 'GET' : 'POST',
        headers: { authorization: `Bearer ${config.secret}`, 'content-type': 'application/json', 'accept-encoding': 'gzip' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
      });
    } catch {
      throw new TransitError('Le calcul des trajets est indisponible. Réessaie dans un instant.');
    }
    const json: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = engineErrorSchema.safeParse(json);
      if (response.status === 422 && error.success && error.data.validUntil) {
        throw new TransitError(`Les horaires sont publiés jusqu’au ${dayLabel(error.data.validUntil)}. Choisis une date plus proche.`);
      }
      if (response.status === 400 && error.success && error.data.error === 'unknown-station') {
        throw new TransitError('Une station n’est plus desservie. Choisis une autre station.');
      }
      throw new TransitError('Le calcul des trajets est indisponible. Réessaie dans un instant.');
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) throw new TransitError('Le calcul des trajets est indisponible. Réessaie dans un instant.');
    return parsed.data;
  }

  async function digest(value: string) {
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))]
      .map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /** Reuses a fresh answer for the same outing; a concurrent identical call waits for the first one. */
  async function remembered(key: string, ttl: number, compute: () => Promise<z.infer<typeof cachedTimesSchema>>) {
    if (!cache) return compute();
    for (let attempt = 0; attempt < 30; attempt++) {
      const state = cacheStateSchema.parse(await cache.claim(key));
      if (state.state === 'ready') {
        const hit = cachedTimesSchema.safeParse(state.payload);
        if (hit.success) return hit.data;
      }
      if (state.state === 'pending') {
        await new Promise(resolve => setTimeout(resolve, 300));
        continue;
      }
      const value = await compute();
      await cache.save(key, value, ttl);
      return value;
    }
    throw new TransitError('Le calcul est encore en cours. Réessaie dans un instant.');
  }

  return {
    meta: (): Promise<EngineMeta> => call('/v1/meta', engineMetaSchema, undefined, 3000),
    /** Durations from one station to every station reachable by `arriveBy`, over the default 2 h window. */
    async oneToAll(origin: string, arriveBy: number): Promise<StationTimes> {
      const key = await digest(`engine:v1:one-to-all:${origin}:${arriveBy}`);
      const value = await remembered(key, 600, async () => {
        const answer = await limited(() => call('/v1/one-to-all', oneToAllResponseSchema, { origin, arriveBy }));
        return { snapshot: answer.snapshot, times: packStationTimes(answer.durations) };
      });
      return unpackStationTimes(value.times);
    },
    /** One batch, 64 items at most. Not cached: the engine answers in a fraction of a second. */
    journeys: (request: JourneysRequest): Promise<JourneysResponse> => call('/v1/journeys', journeysResponseSchema, request),
  };
}
export type EngineClient = ReturnType<typeof createEngineClient>;
