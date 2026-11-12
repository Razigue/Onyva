// End-to-end check of the local stack started by `pnpm dev:local`: local Supabase only, no PRIM call.
// Creates temporary accounts, an outing of two then ten people, chooses a venue and verifies the journeys
// through the engine. With `pnpm dev:local --auto`, also runs the automatic fair search. Accounts are deleted at the end.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { outingSchema, primCoverageSchema, recommendationResponseSchema, stationSchema, venueSchema } from '@onyva/shared';
import type { Database } from '@onyva/shared/database';

const status = z.object({ API_URL: z.string().url(), ANON_KEY: z.string(), SERVICE_ROLE_KEY: z.string() })
  .parse(JSON.parse(execFileSync('pnpm', ['exec', 'supabase', 'status', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })));
if (new URL(status.API_URL).hostname !== '127.0.0.1') throw new Error('Ce contrôle ne vise que Supabase local.');
const admin = createClient<Database>(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const users: string[] = [];

async function account(name: string) {
  const email = `onyva-local-${randomUUID()}@example.invalid`, password = randomUUID();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { given_name: name } });
  if (created.error || !created.data.user) throw new Error('Compte de test indisponible.');
  users.push(created.data.user.id);
  const client = createClient<Database>(status.API_URL, status.ANON_KEY, { auth: { persistSession: false } });
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error) throw new Error('Session de test indisponible.');
  return client;
}

/** Next weekday evening in the timetable period: 19 h to 21 h 30, Paris time in winter. */
function nextEvening(validUntil: string) {
  const day = new Date(Date.now() + 86_400_000);
  while ([0, 6].includes(day.getUTCDay())) day.setUTCDate(day.getUTCDate() + 1);
  const iso = day.toISOString().slice(0, 10);
  if (iso > validUntil) throw new Error(`Instantané trop ancien (jusqu’au ${validUntil}).`);
  return { startsAt: `${iso}T18:00:00.000Z`, endsAt: `${iso}T20:30:00.000Z` };
}

async function run() {
  const owner = await account('Orga');
  const coverage = primCoverageSchema.parse((await owner.functions.invoke('recommend', { body: { action: 'coverage' } })).data);
  if (coverage.provider !== 'engine' || !coverage.manualReady || !coverage.validUntil) {
    throw new Error(`Le moteur ne répond pas à la fonction recommend : ${JSON.stringify(coverage)}. Lance pnpm dev:local.`);
  }
  console.info(`Couverture : moteur prêt, horaires jusqu’au ${coverage.validUntil}, juste milieu ${coverage.ready ? 'activé' : 'en pause'}.`);

  const names = ['Bastille', 'Nation', 'République', 'Châtelet', 'Gare de Lyon', 'Montparnasse - Bienvenüe', 'Saint-Lazare', 'Place d’Italie', 'Denfert-Rochereau', 'Gare du Nord', 'Odéon', 'Opéra', 'Bercy', 'La Motte-Picquet - Grenelle'];
  const catalog = await admin.from('stations').select('id,name,longitude,latitude,lines').eq('active', true)
    .gte('latitude', 48.80).lte('latitude', 48.90).gte('longitude', 2.28).lte('longitude', 2.42)
    .or(names.map(name => `name.ilike.${name}%`).join(',')).order('id');
  const rows = z.array(stationSchema).parse(catalog.data);
  const stations = names.flatMap(name => { const found = rows.find(s => s.name === name || s.name.startsWith(`${name} (`)); return found ? [found] : []; }).slice(0, 10);
  if (stations.length < 10) throw new Error('Dix stations parisiennes de référence requises dans le catalogue local.');

  const { startsAt, endsAt } = nextEvening(coverage.validUntil);
  const created = await owner.rpc('create_outing', { payload: { name: 'Orga', startsAt, endsAt, activity: 'dinner', departureId: stations[0]!.id } });
  if (created.error) throw new Error(`Création refusée (${created.error.code}).`);
  let outing = outingSchema.parse(created.data);
  const join = async (index: number) => {
    const guest = await account(`Ami ${index}`);
    const joined = await guest.rpc('join_outing', { payload: { inviteCode: outing.inviteCode, name: `Ami ${index}`, departureId: stations[index]!.id, returnId: stations[index]!.id } });
    if (joined.error) throw new Error('Adhésion refusée.');
    outing = outingSchema.parse(joined.data);
  };
  await join(1);

  const verify = async (label: string) => {
    const started = performance.now();
    const invoked = await owner.functions.invoke('recommend', { body: { outingId: outing.id } });
    if (invoked.error) throw new Error('Vérification refusée.');
    let result = recommendationResponseSchema.parse(invoked.data);
    for (let attempt = 0; !['complete', 'failed'].includes(result.progress?.stage ?? '') && attempt < 900; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const parsed = recommendationResponseSchema.safeParse((await owner.rpc('get_recommendations', { outing_id: outing.id })).data);
      if (parsed.success) result = parsed.data;
    }
    const best = result.recommendations[0];
    if (result.source !== 'gtfs' || result.progress?.stage !== 'complete' || !best) throw new Error(`${label} : étape ${result.progress?.stage ?? 'inconnue'} (${result.progress?.completed ?? 0}/${result.progress?.total ?? 0}). ${result.warnings.join(' ')}`);
    console.info(`${label} : ${result.recommendations.length} lieu(x) vérifié(s) en ${Math.round(performance.now() - started)} ms, ${best.venue.name}, trajet maximum ${Math.round(best.maximum / 60)} min.`);
  };

  const pick = async () => {
    for (const station of stations) {
      const found = await owner.rpc('list_outing_venues', { target: outing.id, station_id: station.id });
      if (found.error) throw new Error('Recherche des lieux refusée.');
      const venue = z.array(venueSchema).parse(found.data)[0];
      if (venue) return venue;
    }
    throw new Error('Aucun lieu ouvert dans la base locale. Lance : pnpm local:venues');
  };
  const venue = await pick();
  const select = async () => {
    const selected = await owner.rpc('select_outing_venue', { target: outing.id, station_id: venue.stationId, venue_id: venue.id });
    if (selected.error) throw new Error('Choix du lieu refusé.');
    outing = outingSchema.parse(selected.data);
  };
  await select();
  await verify('Lieu choisi, 2 personnes');
  for (let index = 2; index < 10; index++) await join(index);
  await select();
  await verify('Lieu choisi, 10 personnes');

  if (coverage.ready) {
    const auto = await owner.rpc('create_outing', { payload: { name: 'Orga', startsAt, endsAt, activity: 'drinks', departureId: stations[0]!.id } });
    if (auto.error) throw new Error('Création refusée.');
    outing = outingSchema.parse(auto.data);
    for (let index = 1; index < 10; index++) await join(index);
    await verify('Juste milieu, 10 personnes');
  }
}

try {
  await run();
} finally {
  // Deleting the accounts removes their outings in cascade.
  for (const id of users) await admin.auth.admin.deleteUser(id);
}
