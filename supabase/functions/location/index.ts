import { createClient } from '@supabase/supabase-js';
import {
  locationInvocationSchema,
  locationLeaseSchema,
  locationTopic,
  outingSchema,
  recommendationResponseSchema,
} from '../../../packages/shared/src/index.ts';
import type { Database } from '../../../packages/shared/src/generated/database.ts';
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,x-client-info,apikey,content-type',
  'Content-Type': 'application/json',
};
const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });
const encode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
const decode = (value: string) =>
  Uint8Array.from(
    atob(
      value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '='),
    ),
    (character) => character.charCodeAt(0),
  );
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply({ error: 'Méthode non autorisée.' }, 405);
  try {
    const text = await request.text();
    if (text.length > 4096) return reply({ error: 'Demande trop longue.' }, 413);
    const input = locationInvocationSchema.safeParse(JSON.parse(text));
    if (!input.success) return reply({ error: 'Demande invalide.' }, 400);
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return reply({ error: 'Connexion requise.' }, 401);
    const url = Deno.env.get('SUPABASE_URL')!,
      anon = Deno.env.get('SUPABASE_ANON_KEY')!,
      secret = Deno.env.get('LOCATION_SIGNING_SECRET');
    if (!secret || secret.length < 32) return reply({ error: 'Partage indisponible.' }, 503);
    const client = createClient<Database>(url, anon, {
        global: { headers: { Authorization: auth } },
      }),
      user = await client.auth.getUser();
    if (user.error || !user.data.user) return reply({ error: 'Connexion requise.' }, 401);
    const group = await client.rpc('get_outing', { outing_id: input.data.outingId });
    if (group.error) return reply({ error: 'Sortie introuvable.' }, 404);
    const outing = outingSchema.parse(group.data),
      person = outing.participants.find((p) => p.userId === user.data.user!.id);
    if (!person || !outing.confirmedVenueId) {
      return reply({ error: 'Confirme un lieu avant de partager ta position.' }, 409);
    }
    const signing = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    );
    if (input.data.action === 'start') {
      const saved = await client.rpc('get_recommendations', { outing_id: outing.id });
      const venue = recommendationResponseSchema.parse(saved.data).recommendations.find((r) =>
        r.venue.id === outing.confirmedVenueId
      )?.venue;
      if (!venue) return reply({ error: 'Lieu indisponible.' }, 409);
      const now = Date.now(), expiresAt = now + 90 * 60_000;
      const payload = encode(
        new TextEncoder().encode(
          JSON.stringify({
            userId: user.data.user.id,
            outingId: outing.id,
            venueId: venue.id,
            startedAt: now,
            expiresAt,
          }),
        ),
      );
      const signature = encode(
        new Uint8Array(
          await crypto.subtle.sign('HMAC', signing, new TextEncoder().encode(payload)),
        ),
      );
      return reply({
        outingId: outing.id,
        lease: `${payload}.${signature}`,
        expiresAt,
        venue: { latitude: venue.latitude, longitude: venue.longitude },
      });
    }
    const [payload, signature] = input.data.lease.split('.');
    if (
      !payload || !signature ||
      !await crypto.subtle.verify(
        'HMAC',
        signing,
        decode(signature),
        new TextEncoder().encode(payload),
      )
    ) return reply({ error: 'Partage invalide.' }, 403);
    const lease = locationLeaseSchema.parse(JSON.parse(new TextDecoder().decode(decode(payload))));
    if (
      lease.userId !== user.data.user.id || lease.outingId !== outing.id ||
      lease.venueId !== outing.confirmedVenueId || lease.expiresAt - lease.startedAt > 90 * 60_000
    ) return reply({ error: 'Partage invalide.' }, 403);
    const stop = input.data.action === 'stop';
    if (!stop && lease.expiresAt <= Date.now()) return reply({ error: 'Partage terminé.' }, 410);
    if (
      !stop && input.data.action === 'position' &&
      Math.abs(input.data.position.timestamp - Date.now()) > 60_000
    ) return reply({ error: 'Position trop ancienne.' }, 400);
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const payloadToSend = stop
      ? { participantId: person.id }
      : input.data.action === 'position'
      ? { ...input.data.position, participantId: person.id }
      : null;
    // Realtime HTTP broadcast does not insert the payload into realtime.messages.
    const broadcast = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{
          topic: locationTopic(outing),
          event: stop ? 'location-stop' : 'location',
          payload: payloadToSend,
          private: true,
        }],
      }),
      signal: AbortSignal.timeout(5000),
    });
    return broadcast.ok ? reply({ sent: true }) : reply({ error: 'Partage indisponible.' }, 503);
  } catch {
    return reply({ error: 'Partage indisponible.' }, 503);
  }
});
