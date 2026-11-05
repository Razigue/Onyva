import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  outingSchema,
  recommendationInvocationSchema,
  recommendationResponseSchema,
  stationSchema,
  venueSchema,
} from '../../../packages/shared/src/index.ts';
import type { Database } from '../../../packages/shared/src/generated/database.ts';
import { createPrimClient } from '../_shared/prim-client.ts';
import { calculateRecommendations, calculateSelectedVenue } from '../_shared/recommendation.ts';
declare const EdgeRuntime: { waitUntil: (work: Promise<unknown>) => void };
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,x-client-info,apikey,content-type',
  'Content-Type': 'application/json',
};
const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply({ error: 'Méthode non autorisée.' }, 405);
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return reply({ error: 'Connexion requise.' }, 401);
    const client = createClient<Database>(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authorization } } },
    );
    const user = await client.auth.getUser();
    if (user.error || !user.data.user) return reply({ error: 'Connexion requise.' }, 401);
    const input = recommendationInvocationSchema.safeParse(await request.json());
    if (!input.success) return reply({ error: 'Demande invalide.' }, 400);
    const key = Deno.env.get('PRIM_API_KEY'), dailyLimit = Number(Deno.env.get('PRIM_DAILY_LIMIT'));
    // Per-person cap so that one anonymous session cannot drain the shared free quota.
    const configuredUserLimit = Number(Deno.env.get('PRIM_USER_DAILY_LIMIT') ?? 100);
    const userLimit = Number.isInteger(configuredUserLimit) && configuredUserLimit > 0
      ? Math.min(configuredUserLimit, dailyLimit)
      : Math.min(100, dailyLimit);
    const configured = Deno.env.get('PRIM_QUOTA_CONFIRMED') === 'true' && Boolean(key) &&
      Number.isInteger(dailyLimit) && dailyLimit > 0 && dailyLimit <= 1000000;
    const enabled = Deno.env.get('RECOMMENDATIONS_ENABLED') !== 'false';
    if ('action' in input.data) {
      return reply({ ready: configured && enabled, provider: 'prim', quotaVerified: configured, manualReady: configured });
    }
    const data = await client.rpc('get_outing', { outing_id: input.data.outingId });
    if (data.error) return reply({ error: 'Sortie introuvable.' }, 404);
    const outing = outingSchema.parse(data.data);
    if (!enabled && !outing.selectedVenue) return reply({ error: 'Choisis un lieu pour vérifier les trajets.' }, 503);
    const
      saved = await client.rpc('get_recommendations', { outing_id: outing.id }),
      cached = recommendationResponseSchema.safeParse(saved.data);
    if (
      cached.success &&
      (outing.confirmedVenueId || Date.parse(cached.data.computedAt) > Date.now() - 60_000)
    ) return reply(cached.data);
    if (!configured) {
      return reply({ error: 'PRIM n’est pas configuré. Vérifie la clé et le quota gratuit.' }, 503);
    }
    if (outing.participants.length < 2) return reply({ error: 'Ajoute un ami.' }, 400);
    const admin = createClient<Database>(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      ),
      claimId = crypto.randomUUID();
    const claim = await admin.rpc('claim_prim_calculation', {
      target: outing.id,
      expected_revision: outing.updatedAt,
      token: claimId,
    });
    if (claim.error) return reply({ error: 'Calcul indisponible.' }, 503);
    const initial = recommendationResponseSchema.parse({
      source: 'prim',
      computedAt: new Date().toISOString(),
      recommendations: [],
      warnings: [],
      progress: { stage: outing.selectedVenue ? 'returns' : 'isochrones', completed: 0, total: outing.selectedVenue ? 1 : outing.participants.length },
    });
    if (!claim.data) return reply(cached.success ? cached.data : initial, 202);
    const save = async (result: typeof initial) => {
      const validated = recommendationResponseSchema.parse(result);
      const value = await admin.rpc('save_prim_progress', {
        target: outing.id,
        expected_revision: outing.updatedAt,
        token: claimId,
        result: JSON.parse(JSON.stringify(validated)),
      });
      if (value.error) throw new Error('Sauvegarde indisponible.');
      return value.data === true;
    };
    await save(initial);
    const prim = createPrimClient({
      claim: async (cacheKey) => {
        const value = await admin.rpc('claim_prim_cache', { target: outing.id, key: cacheKey });
        if (value.error) throw new Error('Cache indisponible.');
        return value.data;
      },
      save: async (cacheKey, payload, ttl) => {
        const value = await admin.from('prim_cache').update({
          state: 'ready',
          payload: JSON.parse(JSON.stringify(payload)),
          expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
        }).eq('outing_id', outing.id).eq('cache_key', cacheKey);
        if (value.error) throw new Error('Cache indisponible.');
      },
      reserve: async () => {
        const value = await admin.rpc('reserve_prim_user_call', {
          requester: user.data.user.id,
          daily_limit: dailyLimit,
          user_limit: userLimit,
        });
        if (value.error) throw new Error('Quota indisponible.');
        return value.data === true;
      },
    }, key!);
    EdgeRuntime.waitUntil(
      (outing.selectedVenue ? calculateSelectedVenue : calculateRecommendations)(outing, {
        prim,
        save,
        stations: async () => {
          const rows = [];
          for (let offset = 0;; offset += 1000) {
            const value = await admin.from('stations').select('id,name,longitude,latitude,lines')
              .eq('active', true).order('id').range(offset, offset + 999);
            if (value.error) throw new Error('Stations indisponibles.');
            rows.push(...value.data);
            if (value.data.length < 1000) {
              break;
            }
          }
          return z.array(stationSchema).parse(rows);
        },
        venues: async (stationIds) => {
          const value = await admin.rpc('nearby_venues', {
            station_ids: stationIds,
            activity_kind: outing.activity, starts_at_epoch: Date.parse(outing.startsAt)/1000, ends_at_epoch: Date.parse(outing.endsAt)/1000,
          });
          if (value.error) throw new Error('Lieux indisponibles.');
          return z.array(venueSchema).parse(value.data);
        },
      }).catch(() => undefined),
    );
    return reply(initial, 202);
  } catch {
    return reply({ error: 'Calcul indisponible. Réessaie.' }, 503);
  }
});
