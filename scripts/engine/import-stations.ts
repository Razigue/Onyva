// Station catalogue from the compiled GTFS snapshot, replacing the PRIM import (scripts/import-stations.ts).
// No PRIM call. Identifiers keep the catalogue format `stop_area:IDFM:<n>`, so outings in progress stay valid.
// Existing stations keep their name (PRIM labels carry the town) and position; only their lines change.
// Stations served by the GTFS but absent from the catalogue are added. Nothing is deactivated.
// Dry run by default: `pnpm engine:import-stations [snapshot] --apply` writes to the Supabase project of .env.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { stationSchema } from '@onyva/shared';
import type { Database } from '@onyva/shared/database';
import { deserializeNetwork } from '@onyva/transit-engine';
import type { Network } from '@onyva/transit-engine';
import { resolveSnapshotFile } from '../../apps/engine/src/snapshot.ts';

const MAX_LINES = 10;

/** Display label of a GTFS route: M4, RER B, L, T3a, 38. */
export function lineLabel(name: string, type: number): string {
  if (type === 1) return `M${name}`;
  if (type === 2 && /^[A-E]$/.test(name)) return `RER ${name}`;
  if (type === 7) return 'Funiculaire';
  if (type === 6) return `Câble ${name}`;
  return name;
}
const rank = (type: number) => ({ 1: 0, 2: 1, 0: 2, 7: 3, 6: 3 } as Record<number, number>)[type] ?? 4;

/** Lines serving each station, rail first, then buses in numeric order, ten at most. */
export function stationLines(net: Network): Map<string, string[]> {
  const found = new Map<number, Map<string, number>>();
  for (let p = 0; p < net.patternRoute.length; p++) {
    const route = net.patternRoute[p]!, label = lineLabel(net.routeNames[route]!, net.routeTypes[route]!);
    for (let i = net.patternStopOffsets[p]!; i < net.patternStopOffsets[p + 1]!; i++) {
      const station = net.stopStation[net.patternStops[i]!]!;
      const lines = found.get(station) ?? new Map<string, number>();
      lines.set(label, net.routeTypes[route]!);
      found.set(station, lines);
    }
  }
  const result = new Map<string, string[]>();
  for (const [station, lines] of found) {
    const sorted = [...lines].sort(([a, ta], [b, tb]) => rank(ta) - rank(tb) || a.localeCompare(b, 'fr', { numeric: true }));
    result.set(net.stationIds[station]!, sorted.slice(0, MAX_LINES).map(([label]) => label));
  }
  return result;
}

async function main() {
  const args = process.argv.slice(2), apply = args.includes('--apply');
  const file = await resolveSnapshotFile(args.find(arg => !arg.startsWith('--')) ?? 'data/engine');
  const net = deserializeNetwork(new Uint8Array(await readFile(file)));
  const lines = stationLines(net);
  console.info(`Instantané ${file} : ${net.stationIds.length} stations, ${lines.size} desservies.`);

  if (existsSync('.env')) process.loadEnvFile('.env');
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Configure SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env.');
  const client = createClient<Database>(url, key);
  const existing = new Map<string, { name: string; longitude: number; latitude: number; active: boolean }>();
  for (let offset = 0; ; offset += 1000) {
    const page = await client.from('stations').select('id,name,longitude,latitude,active').order('id').range(offset, offset + 999);
    if (page.error) throw new Error('Lecture du catalogue impossible.');
    for (const row of page.data) existing.set(row.id, row);
    if (page.data.length < 1000) break;
  }

  const rows: Database['public']['Tables']['stations']['Insert'][] = [], added: string[] = [], rejected: string[] = [];
  net.stationIds.forEach((id, index) => {
    const served = lines.get(id);
    if (!served) return;
    const current = existing.get(id);
    const station = stationSchema.safeParse(current
      ? { id, name: current.name, longitude: current.longitude, latitude: current.latitude, lines: served }
      : { id, name: net.stationNames[index], longitude: net.stationLon[index], latitude: net.stationLat[index], lines: served });
    if (!station.success) { rejected.push(id); return; }
    if (!current) added.push(`${id} ${station.data.name}`);
    rows.push({ ...station.data, active: current ? current.active : true });
  });
  const unserved = [...existing].filter(([id, row]) => row.active && !lines.has(id)).map(([id]) => id);
  console.info(`Catalogue : ${existing.size} stations. Mises à jour : ${rows.length - added.length}. Ajouts : ${added.length}. Hors Île-de-France ou invalides : ${rejected.length}. Actives sans desserte GTFS : ${unserved.length}.`);
  for (const line of added) console.info(`  + ${line}`);
  for (const id of rejected.slice(0, 50)) console.info(`  ! ${id}`);
  for (const id of unserved.slice(0, 50)) console.info(`  ? ${id}`);
  if (!apply) { console.info('Simulation : rien n’est écrit. Ajoute --apply pour importer.'); return; }
  for (let i = 0; i < rows.length; i += 1000) {
    const result = await client.from('stations').upsert(rows.slice(i, i + 1000), { onConflict: 'id' });
    if (result.error) throw new Error(`Import interrompu après ${i} stations.`);
  }
  console.info(`Import terminé : ${rows.length} stations écrites.`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
