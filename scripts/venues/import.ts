import { createReadStream, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@onyva/shared/database';
import { openIntervals, parseCuisines, parseOutdoorSeating } from './hours';
if (existsSync('.env')) process.loadEnvFile('.env');
if (process.env.TZ !== 'Europe/Paris') throw new Error('Utilise TZ=Europe/Paris.');
const path = process.env.OSM_VENUES_FILE;
if (!path) throw new Error('OSM_VENUES_FILE est requis.');
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Configure Supabase côté serveur.');
const client = createClient<Database>(url, key), batchId = randomUUID();
const from = new Date();
from.setHours(0, 0, 0, 0);
const to = new Date(from);
to.setDate(to.getDate() + 16);
const recordSchema = z.object({
  id: z.string().regex(/^osm-(node|way|relation)-\d+$/),
  name: z.string().min(1),
  kind: z.enum(['dinner', 'drinks', 'coffee']),
  latitude: z.number().min(48.1).max(49.3),
  longitude: z.number().min(1.4).max(3.6),
  openingHours: z.string().nullable(),
  tags: z.record(z.string()),
});
let count = 0;
let rows: Database['public']['Tables']['osm_venues']['Insert'][] = [];
async function flush() {
  if (!rows.length) return;
  const result = await client.from('osm_venues').upsert(rows, { onConflict: 'import_id,id' });
  if (result.error) throw new Error(`Import des lieux interrompu (${result.error.code}). L’ancien catalogue reste actif.`);
  count += rows.length;
  rows = [];
}
for await (const line of createInterface({ input: createReadStream(path), crlfDelay: Infinity })) {
  if (!line.trim()) continue;
  const item = recordSchema.parse(JSON.parse(line));
  rows.push({
    import_id: batchId,
    id: item.id,
    name: item.name,
    kind: item.kind,
    latitude: item.latitude,
    longitude: item.longitude,
    opening_hours: item.openingHours,
    cuisines: parseCuisines(item.tags),
    outdoor_seating: parseOutdoorSeating(item.tags),
    open_intervals: item.openingHours ? openIntervals(item.openingHours, from, to) : [],
  });
  if (rows.length === 250) await flush();
}
await flush();
const activated = await client.rpc('activate_venue_import', {
  batch_id: batchId,
  expected_count: count,
});
if (activated.error) throw new Error('Le catalogue incomplet n’a pas été activé.');
console.info(
  `Import OSM terminé : ${count} lieux. Attribution : © les contributeurs OpenStreetMap, ODbL.`,
);
