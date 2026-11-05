import { z } from 'zod';
import { primJourneysSchema, primRequestSchema } from '../../../packages/shared/src/index.ts';
import type { PrimRequest } from '../../../packages/shared/src/index.ts';
import { readIsochrone } from '../../../packages/fairness/src/prim.ts';

export const stationTimesSchema = z.array(
  z.object({ stationId: z.string().min(1), duration: z.number().nonnegative() }),
).max(20000);
export type PrimCache = {
  claim: (key: string) => Promise<unknown>;
  save: (key: string, payload: unknown, ttl: number) => Promise<void>;
  reserve: () => Promise<boolean>;
};
const cacheStateSchema = z.object({
  state: z.enum(['ready', 'pending', 'claimed']),
  payload: z.unknown().optional(),
});
export function primUrl(input: PrimRequest): URL {
  const request = primRequestSchema.parse(input);
  // Single-origin /journeys is Navitia's tabular isochrone service.
  const url = new URL(
    'https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/journeys',
  );
  url.searchParams.set('from', request.from);
  if (request.to) url.searchParams.set('to', request.to);
  for (
    const [key, value] of Object.entries({
      datetime: request.at.replace(/\.\d{3}Z$/, 'Z'),
      datetime_represents: request.direction,
      data_freshness: request.freshness,
      'first_section_mode[]': 'walking',
      'last_section_mode[]': 'walking',
      max_duration: '86400',
      language: 'fr-FR',
      depth: '2',
      count: request.kind === 'isochrone' ? '1000' : '1',
    })
  ) url.searchParams.set(key, value);
  return url;
}
export function createPrimClient(cache: PrimCache, apiKey: string, send: typeof fetch = fetch) {
  let active = 0;
  const waiting: (() => void)[] = [];
  async function limited<T>(work: () => Promise<T>): Promise<T> {
    if (active >= 6) await new Promise<void>((resolve) => waiting.push(resolve));
    else active++;
    try {
      return await work();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  }
  async function request(input: PrimRequest): Promise<unknown> {
    const parsed = primRequestSchema.parse(input);
    const key = [
      ...new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(primUrl(parsed).toString())),
      ),
    ].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return limited(async () => {
      for (let attempt = 0; attempt < 24; attempt++) {
        const state = cacheStateSchema.parse(await cache.claim(key));
        if (state.state === 'ready') return state.payload;
        if (state.state === 'pending') {
          await new Promise((resolve) => setTimeout(resolve, 400));
          continue;
        }
        if (!await cache.reserve()) throw new Error('Quota PRIM atteint. Réessaie demain.');
        const response = await send(primUrl(parsed), {
          headers: { apiKey },
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) {
          throw new Error(
            response.status === 429
              ? 'Quota PRIM atteint.'
              : 'PRIM est indisponible. Réessaie dans un instant.',
          );
        }
        const json = primJourneysSchema.parse(await response.json());
        if (json.error && json.error.id !== 'no_solution') {
          throw new Error('PRIM ne couvre pas ce créneau.');
        }
        const payload = parsed.kind === 'isochrone' ? stationTimesSchema.parse(readIsochrone(json)) : json;
        await cache.save(key, payload, 180);
        return payload;
      }
      throw new Error('Le calcul est encore en cours. Réessaie dans un instant.');
    });
  }
  return {
    isochrone: async (from: string, at: string, freshness: PrimRequest['freshness']) =>
      stationTimesSchema.parse(
        await request({ kind: 'isochrone', from, at, freshness, direction: 'departure' }),
      ),
    journey: async (
      from: string,
      to: string,
      at: string,
      direction: PrimRequest['direction'],
      freshness: PrimRequest['freshness'],
    ) =>
      primJourneysSchema.parse(
        await request({ kind: 'journey', from, to, at, direction, freshness }),
      ),
  };
}
