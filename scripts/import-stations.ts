import { existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@onyva/shared/database';
import { primPlaceSchema, stationSchema } from '@onyva/shared';
if (existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY,
  primKey = process.env.PRIM_API_KEY,
  limit = Number(process.env.PRIM_DAILY_LIMIT);
if (
  process.env.PRIM_QUOTA_CONFIRMED !== 'true' || !url || !key || !primKey ||
  !Number.isInteger(limit) || limit < 1
) throw new Error('Configure Supabase, PRIM et un quota gratuit vérifié.');
const client = createClient<Database>(url, key);
const responseSchema = z.object({
  stop_areas: z.array(primPlaceSchema.shape.stop_area.unwrap()),
  pagination: z.object({ total_result: z.number(), items_on_page: z.number() }),
});
let count = 0;
for (let page = 0; page < 100; page++) {
  const reservation = await client.rpc('reserve_prim_call', {
    api_name: 'general',
    daily_limit: limit,
  });
  if (reservation.error || !reservation.data) throw new Error('Quota PRIM atteint.');
  const response = await fetch(
    `https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/stop_areas?count=1000&start_page=${page}`,
    { headers: { apiKey: primKey }, signal: AbortSignal.timeout(15000) },
  );
  if (!response.ok) throw new Error(`Catalogue PRIM indisponible (${response.status}).`);
  const parsed = responseSchema.parse(await response.json());
  const rows = parsed.stop_areas.flatMap((stop) => {
    const station = stationSchema.safeParse({
      id: stop.id,
      name: stop.label ?? stop.name,
      latitude: Number(stop.coord.lat),
      longitude: Number(stop.coord.lon),
      lines: [],
    });
    return station.success ? [{ ...station.data, active: true }] : [];
  });
  const result = await client.from('stations').upsert(rows, { onConflict: 'id' });
  if (result.error) throw new Error('Import des stations interrompu.');
  count += parsed.stop_areas.length;
  if (count >= parsed.pagination.total_result) {
    console.info(`Catalogue PRIM : ${count} stations examinées.`);
    break;
  }
  if (!parsed.pagination.items_on_page || page === 99) throw new Error('Catalogue PRIM incomplet.');
}
