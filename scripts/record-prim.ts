import { writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { primJourneysSchema, primRequestSchema, stationSchema } from '@onyva/shared';
import type { Database } from '@onyva/shared/database';
import type { PrimRequest } from '@onyva/shared';
import { primUrl } from '../supabase/functions/_shared/prim-client';
process.loadEnvFile('.env');
const apiKey = process.env.PRIM_API_KEY, limit = Number(process.env.PRIM_DAILY_LIMIT);
if (
  !apiKey || process.env.PRIM_QUOTA_CONFIRMED !== 'true' || !Number.isInteger(limit) || limit < 1
) throw new Error('Clé PRIM et quota gratuit confirmé requis.');
const originIds = (process.env.PRIM_FIXTURE_ORIGIN_IDS ?? '').split(',').filter(Boolean),
  destinationId = process.env.PRIM_FIXTURE_DESTINATION_ID;
if (originIds.length < 2 || originIds.length > 10 || !destinationId) {
  throw new Error(
    'Choisis 2 à 10 stations de départ et une station de destination pour les captures.',
  );
}
const at = process.env.PRIM_FIXTURE_MEETING_AT!, endsAt = process.env.PRIM_FIXTURE_ENDS_AT!;
primRequestSchema.parse({
  kind: 'journey',
  from: 'validation',
  to: 'validation',
  direction: 'arrival',
  freshness: 'base_schedule',
  at,
});
if (!endsAt || !Number.isFinite(Date.parse(endsAt)) || Date.parse(endsAt) <= Date.parse(at)) {
  throw new Error('Renseigne une fin postérieure au rendez-vous.');
}
const client = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
const stations = await client.from('stations').select('id,name,latitude,longitude,lines').in('id', [
  ...originIds,
  destinationId,
]).eq('active', true);
if (stations.error) throw new Error('Catalogue de stations indisponible.');
const ref = (id: string) => {
  const station = stationSchema.parse(stations.data?.find((s) => s.id === id));
  return `${station.longitude};${station.latitude}`;
};
const measurements: { kind: string; elapsedMs: number }[] = [];
async function request(input: PrimRequest) {
  const reserved = await client.rpc('reserve_prim_call', {
    api_name: 'general',
    daily_limit: limit,
  });
  if (reserved.error || !reserved.data) throw new Error('Quota PRIM atteint.');
  const started = performance.now();
  const response = await fetch(primUrl(input), {
    headers: { apiKey: apiKey! },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`PRIM a refusé la capture (${response.status}).`);
  const data: unknown = await response.json();
  primJourneysSchema.parse(data);
  measurements.push({ kind: input.kind, elapsedMs: Math.round(performance.now() - started) });
  return data;
}
const participants = [];
for (const [index, id] of originIds.entries()) {
  const from = ref(id), to = ref(destinationId), participantId = `capture-${index + 1}`;
  const isochrone = await request({
    kind: 'isochrone',
    from,
    at,
    direction: 'departure',
    freshness: 'base_schedule',
  });
  const outbound = await request({
    kind: 'journey',
    from,
    to,
    at,
    direction: 'arrival',
    freshness: 'base_schedule',
  });
  const inbound = await request({
    kind: 'journey',
    from: to,
    to: from,
    at: endsAt,
    direction: 'departure',
    freshness: 'base_schedule',
  });
  participants.push({ participantId, stationId: id, isochrone, outbound, inbound });
}
const fixture = {
  provenance: {
    capturedFromPrim: true,
    capturedAt: new Date().toISOString(),
    source: 'PRIM IDFM/Navitia',
    license: 'Licence Mobilité',
  },
  meetingAt: at,
  endsAt,
  participants,
  measurements,
};
const sanitized = JSON.stringify(fixture, null, 2).replaceAll(apiKey, '[secret retiré]');
await writeFile('packages/fairness/fixtures/prim-recorded.json', sanitized + '\n');
console.info(
  `Captures PRIM enregistrées : ${measurements.length} requêtes. Vérifie leur provenance et les itinéraires de référence avant de les partager.`,
);
