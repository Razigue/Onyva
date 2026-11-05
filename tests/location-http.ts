import { createClient } from '@supabase/supabase-js';
import { createHmac, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import {
  locationPayloadSchema,
  locationTopic,
  outingSchema,
  recommendationResponseSchema,
  trackingSessionSchema,
} from '@onyva/shared';
import type { Database } from '@onyva/shared/database';
process.loadEnvFile('.env');
process.loadEnvFile('apps/mobile/.env.local');
const url = process.env.SUPABASE_URL!, anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
if (new URL(url).hostname !== '127.0.0.1') throw new Error('Ce test est réservé à Supabase local.');
const admin = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const users: { id: string; token: string; client: ReturnType<typeof createClient<Database>> }[] =
  [];
const stationId = `test-${randomUUID()}`;
async function user() {
  const email = `onyva-location-${randomUUID()}@example.test`, password = randomUUID();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error('Compte de test indisponible.');
  const client = createClient<Database>(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.session) throw new Error('Session de test indisponible.');
  const result = { id: created.data.user.id, token: signed.data.session.access_token, client };
  users.push(result);
  return result;
}
const call = (body: unknown, token?: string) =>
  fetch(`${url}/functions/v1/location`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
try {
  const owner = await user(), guest = await user(), stranger = await user();
  const seeded = await admin.from('stations').insert({
    id: stationId,
    name: 'Station de test HTTP',
    latitude: 48.86,
    longitude: 2.36,
    lines: [],
    active: false,
  });
  assert.equal(seeded.error, null);
  const startsAt = new Date(Date.now() + 3600000).toISOString(),
    endsAt = new Date(Date.now() + 12600000).toISOString();
  const created = await owner.client.rpc('create_outing', {
    payload: { name: 'Test HTTP', startsAt, endsAt, activity: 'coffee', departureId: stationId },
  });
  let outing = outingSchema.parse(created.data);
  const joined = await guest.client.rpc('join_outing', {
    payload: {
      inviteCode: outing.inviteCode,
      name: 'Test réception',
      departureId: stationId,
      returnId: stationId,
    },
  });
  outing = outingSchema.parse(joined.data);
  const emptyJourney = {
    departure: Date.parse(startsAt) / 1000,
    arrival: Date.parse(startsAt) / 1000,
    duration: 0,
    legs: [],
    night: false,
  };
  const recommendations = recommendationResponseSchema.parse({
    source: 'prim',
    computedAt: new Date().toISOString(),
    progress: { stage: 'complete', completed: 1, total: 1 },
    warnings: [],
    recommendations: [{
      venue: {
        id: 'test-venue-http',
        name: 'Lieu de test privé',
        stationId,
        neighborhood: 'Test',
        kind: 'coffee',
        walkSeconds: 0,
        longitude: 2.36,
        latitude: 48.86,
        openIntervals: [],
        source: 'osm',
      },
      journeys: outing.participants.map((p) => ({
        participantId: p.id,
        outbound: emptyJourney,
        inbound: emptyJourney,
      })),
      maximum: 0,
      sum: 0,
      spread: 0,
    }],
  });
  assert.equal(
    (await admin.from('outings').update({
      recommendations: JSON.parse(JSON.stringify(recommendations)),
    }).eq('id', outing.id)).error,
    null,
  );
  outing = outingSchema.parse(
    (await owner.client.rpc('confirm_venue', { outing_id: outing.id, venue_id: 'test-venue-http' }))
      .data,
  );
  assert.equal((await call({ action: 'start', outingId: outing.id })).status, 401);
  assert.equal((await call({ action: 'start', outingId: outing.id }, stranger.token)).status, 404);
  const start = await call({ action: 'start', outingId: outing.id }, owner.token);
  assert.equal(start.status, 200);
  const tracking = trackingSessionSchema.parse(await start.json());
  await guest.client.realtime.setAuth(guest.token);
  const topic = locationTopic(outing);
  let receive: (value: unknown) => void = () => undefined;
  const received = new Promise<unknown>((resolve) => {
    receive = resolve;
  });
  const channel = guest.client.channel(topic, { config: { private: true } }).on('broadcast', {
    event: 'location',
  }, (message) => receive(message.payload));
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Abonnement privé indisponible.')), 10000);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timeout);
        resolve();
      } else if (['CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) {
        clearTimeout(timeout);
        reject(new Error('Abonnement privé refusé.'));
      }
    });
  });
  const body = {
    action: 'position',
    outingId: outing.id,
    lease: tracking.lease,
    position: { latitude: 48.861, longitude: 2.361, accuracy: 10, timestamp: Date.now() },
  };
  assert.equal(
    (await call({ ...body, lease: tracking.lease + 'invalid' }, owner.token)).status,
    403,
  );
  assert.equal((await call(body, owner.token)).status, 200);
  const point = locationPayloadSchema.parse(
    await Promise.race([
      received,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Relais HTTP non reçu.')), 8000)
      ),
    ]),
  );
  assert.equal(point.participantId, outing.participants.find((p) => p.userId === owner.id)!.id);
  const expiredPayload = Buffer.from(
    JSON.stringify({
      userId: owner.id,
      outingId: outing.id,
      venueId: 'test-venue-http',
      startedAt: Date.now() - 91 * 60000,
      expiresAt: Date.now() - 60000,
    }),
  ).toString('base64url');
  const signature = createHmac('sha256', process.env.LOCATION_SIGNING_SECRET!).update(
    expiredPayload,
  ).digest('base64url');
  assert.equal(
    (await call({ ...body, lease: `${expiredPayload}.${signature}` }, owner.token)).status,
    410,
  );
  const stored = await admin.from('outings').select('recommendations').eq('id', outing.id).single();
  assert.deepEqual(stored.data?.recommendations, recommendations);
  assert.equal(
    (await call({ action: 'stop', outingId: outing.id, lease: tracking.lease }, owner.token))
      .status,
    200,
  );
  console.info(
    'Relais HTTP privé validé : membre reçu, intrus refusé, signature et expiration contrôlées, recommandations inchangées.',
  );
} finally {
  for (const item of users) {
    await item.client.removeAllChannels();
    await admin.auth.admin.deleteUser(item.id);
  }
  await admin.from('stations').delete().eq('id', stationId);
}
