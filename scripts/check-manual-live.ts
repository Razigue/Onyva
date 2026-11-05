import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { outingSchema, stationSchema, venueSchema, recommendationResponseSchema, primCoverageSchema } from '@onyva/shared';
import type { Database } from '@onyva/shared/database';
process.loadEnvFile('.env');
if (process.env.ONYVA_LIVE_TEST_CONFIRMED !== 'true') throw new Error('Ce test crée deux comptes temporaires et consomme jusqu’à 20 appels PRIM gratuits. Active ONYVA_LIVE_TEST_CONFIRMED pour le lancer.');
const url = process.env.SUPABASE_URL!, anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const users: string[] = [];
async function account(name: string) {
  const email = `onyva-check-${randomUUID()}@example.invalid`, password = randomUUID();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { given_name: name } });
  if (created.error || !created.data.user) throw new Error('Compte de test indisponible.');
  users.push(created.data.user.id);
  const client = createClient<Database>(url, anon, { auth: { persistSession: false } });
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.session) throw new Error('Session de test indisponible.');
  return { client, token: signed.data.session.access_token };
}
async function run() {
  const owner = await account('Test organisateur'), guest = await account('Test invité');
  const names = ['Bastille', 'Nation', 'République', 'Châtelet', 'Gare de Lyon', 'Montparnasse - Bienvenüe', 'Saint-Lazare', 'Place d’Italie', 'Denfert-Rochereau', 'Gare du Nord', 'Odéon', 'Opéra', 'Bercy', 'La Motte-Picquet - Grenelle'];
  const catalog = await admin.from('stations').select('id,name,longitude,latitude,lines').eq('active', true).gte('latitude', 48.80).lte('latitude', 48.90).gte('longitude', 2.28).lte('longitude', 2.42).or(names.map(name => `name.ilike.${name}%`).join(',')).order('id');
  if (catalog.error) throw new Error('Stations de référence indisponibles.');
  const rows = z.array(stationSchema).parse(catalog.data);
  const stations = names.flatMap(name => { const value = rows.find(s => s.name === name || s.name.startsWith(name + ' (')); return value ? [value] : []; }).slice(0, 10);
  if (stations.length < 10) throw new Error('Dix stations de référence requises.');
  const day = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const startsAt = `${day}T18:00:00.000Z`, endsAt = `${day}T20:30:00.000Z`;
  const created = await owner.client.rpc('create_outing', { payload: { name: 'Test organisateur', startsAt, endsAt, activity: 'dinner', departureId: stations[0]!.id } });
  if (created.error) throw new Error(`Création refusée (${created.error.code}).`);
  let outing = outingSchema.parse(created.data);
  const hidden = await guest.client.from('outings').select('id').eq('id', outing.id);
  if (hidden.error || hidden.data.length) throw new Error('La sortie doit rester privée avant adhésion.');
  const preview = await guest.client.rpc('preview_invitation', { invite_code: outing.inviteCode });
  const short = z.object({ shortCode: z.string().length(8) }).parse(preview.data);
  const resolved = await guest.client.rpc('resolve_invite_code', { short_code: short.shortCode });
  if (resolved.error || resolved.data !== outing.inviteCode) throw new Error('Résolution du code court incorrecte.');
  const joined = await guest.client.rpc('join_outing', { payload: { inviteCode: outing.inviteCode, name: 'Test invité', departureId: stations[1]!.id, returnId: stations[1]!.id } });
  if (joined.error) throw new Error('Adhésion refusée.');
  outing = outingSchema.parse(joined.data);
  let venue: z.infer<typeof venueSchema> | undefined;
  for (const station of stations) {
    const found = await owner.client.rpc('list_outing_venues', { target: outing.id, station_id: station.id });
    if (found.error) throw new Error('Recherche des lieux refusée.');
    venue = z.array(venueSchema).parse(found.data)[0];
    if (venue) break;
  }
  if (!venue) throw new Error('Aucun lieu ouvert pour le créneau de référence.');
  const selected = await owner.client.rpc('select_outing_venue', { target: outing.id, station_id: venue.stationId, venue_id: venue.id });
  if (selected.error) throw new Error('Choix du lieu refusé.');
  outing = outingSchema.parse(selected.data);
  const coverage = await owner.client.functions.invoke('recommend', { body: { action: 'coverage' } });
  if (!primCoverageSchema.parse(coverage.data).manualReady) throw new Error('Vérification manuelle non configurée.');
  async function verify(label: string) {
    const start = performance.now();
    const invoked = await owner.client.functions.invoke('recommend', { body: { outingId: outing.id } });
    if (invoked.error) throw new Error('Vérification des trajets refusée.');
    let result = recommendationResponseSchema.parse(invoked.data);
    const firstProgressMs = Math.round(performance.now() - start);
    for (let attempt = 0; !['complete', 'failed'].includes(result.progress?.stage ?? '') && attempt < 80; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const saved = await owner.client.rpc('get_recommendations', { outing_id: outing.id });
      if (saved.error) throw new Error('Lecture des trajets refusée.');
      const parsed = recommendationResponseSchema.safeParse(saved.data);
      if (parsed.success) result = parsed.data;
    }
    if (result.progress?.stage !== 'complete' || result.recommendations.length !== 1) {
      const cache = await admin.from('prim_cache').select('payload').eq('outing_id', outing.id);
      writeFileSync('data/manual-live-diagnostics.json', JSON.stringify({ outing, result, cache: cache.data }, null, 2));
      throw new Error(`Trajets non vérifiés : ${result.warnings.join(' ')}`);
    }
    const elapsedMs = Math.round(performance.now() - start);
    const cache = await admin.from('prim_cache').select('cache_key', { count: 'exact', head: true }).eq('outing_id', outing.id);
    console.info(`${label} : progression ${firstProgressMs} ms, résultat vérifié ${elapsedMs} ms, ${cache.count} trajets en cache.`);
    return result;
  }
  await verify('Deux participants');
  for (const [index, station] of stations.slice(2).entries()) {
    const added = await owner.client.rpc('add_participant', { outing_id: outing.id, person_name: `Test ami ${index + 3}`, departure_id: station.id, return_id: station.id });
    if (added.error) throw new Error('Ajout d’un participant refusé.');
    outing = outingSchema.parse(added.data);
  }
  const final = await verify('Dix participants');
  if (final.recommendations[0]!.journeys.length !== 10) throw new Error('Un trajet manque.');
  const confirmed = await owner.client.rpc('confirm_venue', { outing_id: outing.id, venue_id: venue.id });
  if (confirmed.error || outingSchema.parse(confirmed.data).confirmedVenueId !== venue.id) throw new Error('Confirmation refusée.');
  const seen = await guest.client.rpc('get_outing', { outing_id: outing.id });
  if (seen.error || outingSchema.parse(seen.data).confirmedVenueId !== venue.id) throw new Error('Confirmation non partagée.');
  console.info('Parcours distant réussi : invitation, code court, adhésion, choix manuel, trajets et confirmation à dix.');
}
try { await run(); }
finally {
  for (const id of users.reverse()) {
    const result = await admin.auth.admin.deleteUser(id);
    if (result.error) { console.error('Nettoyage du compte temporaire à vérifier.'); process.exitCode = 1; }
  }
  if (!process.exitCode) console.info('Comptes temporaires et données de test supprimés.');
}
