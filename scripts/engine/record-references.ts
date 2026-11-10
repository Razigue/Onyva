// Records 20 real PRIM journeys, station to station, as independent references for the transit engine.
// Every call is reserved in the shared PRIM counter first. Exactly 20 calls at most, never retried.
// Usage: pnpm engine:record-references --dry-run   (resolves the stations in the snapshot, no PRIM call)
//        pnpm engine:record-references             (PRIM key and confirmed free quota required)
// Raw answers stay in data/prim-references (ignored by Git); a faithful extract goes to packages/transit-engine/fixtures.
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { primJourneysSchema } from '@onyva/shared';
import type { PrimJourneys } from '@onyva/shared';
import type { Database } from '@onyva/shared/database';
import { deserializeNetwork } from '@onyva/transit-engine';
import { primUrl } from '../../supabase/functions/_shared/prim-client';

const MAX_CALLS = 20;
type Direction = 'departure' | 'arrival';
// Public stations, varied on purpose: RER, metro with changes, Transilien, tram, airport, night, weekend, early morning.
// Times are Paris local time, November 2026 (UTC+1). `arrival` means "arrive at the latest at".
const cases: Array<{ label: string; from: string; to: string; at: string; direction: Direction }> = [
  { label: 'RER A, heure de pointe', from: 'Nation', to: 'La Défense', at: '2026-11-12T08:30', direction: 'departure' },
  { label: 'RER B vers l’aéroport', from: 'Gare du Nord', to: 'Aéroport CDG (Terminal 2) - TGV', at: '2026-11-12T07:15', direction: 'departure' },
  { label: 'Banlieue nord vers banlieue sud', from: 'Saint-Denis', to: 'Massy - Palaiseau', at: '2026-11-12T18:10', direction: 'departure' },
  { label: 'Métro avec correspondance', from: 'Bastille', to: 'Porte de Clignancourt', at: '2026-11-12T19:05', direction: 'departure' },
  { label: 'Métro 8 puis réseau ferré', from: 'Créteil - Préfecture', to: 'Gare Montparnasse', at: '2026-11-12T17:40', direction: 'departure' },
  { label: 'Transilien N', from: 'Versailles Chantiers', to: 'Gare Montparnasse', at: '2026-11-18T08:05', direction: 'departure' },
  { label: 'RER A de bout en bout', from: 'Cergy le Haut', to: 'Châtelet - Les Halles', at: '2026-11-18T07:50', direction: 'departure' },
  { label: 'Est vers le centre', from: 'Marne-la-Vallée - Chessy', to: 'Opéra', at: '2026-11-18T18:20', direction: 'departure' },
  { label: 'Métro 9 direct', from: 'Pont de Sèvres', to: 'République', at: '2026-11-18T20:10', direction: 'departure' },
  { label: 'Métro 7 traversant', from: 'La Courneuve - 8 Mai 1945', to: 'Villejuif - Louis Aragon', at: '2026-11-18T12:30', direction: 'departure' },
  { label: 'Tramway T2', from: 'La Défense', to: 'Issy Val de Seine', at: '2026-11-18T10:15', direction: 'departure' },
  { label: 'Métro 14 vers Orly', from: 'Gare Saint-Lazare', to: 'Aéroport d’Orly (Terminaux 1-2-3)', at: '2026-11-18T09:40', direction: 'departure' },
  { label: 'Nuit, métro fermé', from: 'Châtelet - Les Halles', to: 'Créteil - Préfecture', at: '2026-11-14T02:10', direction: 'departure' },
  { label: 'Retour tardif du samedi', from: 'République', to: 'Cergy le Haut', at: '2026-11-14T23:30', direction: 'departure' },
  { label: 'Dimanche matin', from: 'Nation', to: 'Saint-Denis', at: '2026-11-15T09:00', direction: 'departure' },
  { label: 'Dernier retour en semaine', from: 'Opéra', to: 'Marne-la-Vallée - Chessy', at: '2026-11-19T23:45', direction: 'departure' },
  { label: 'Tôt le matin, RER D', from: 'Gare de Lyon', to: 'Melun', at: '2026-11-18T06:00', direction: 'departure' },
  { label: 'Arrivée imposée, vendredi soir', from: 'Massy - Palaiseau', to: 'Bastille', at: '2026-11-20T20:00', direction: 'arrival' },
  { label: 'Arrivée imposée, vers Versailles', from: 'Gare Saint-Lazare', to: 'Versailles Chantiers', at: '2026-11-18T19:30', direction: 'arrival' },
  { label: 'Arrivée imposée, samedi', from: 'Pont de Sèvres', to: 'Nation', at: '2026-11-14T21:00', direction: 'arrival' },
];
if (cases.length !== MAX_CALLS) throw new Error(`Exactement ${MAX_CALLS} captures attendues.`);

const dir = 'data/engine', files = (await readdir(dir)).filter(name => name.endsWith('.bin'));
const newest = (await Promise.all(files.map(async name => ({ name, time: (await stat(join(dir, name))).mtimeMs })))).sort((a, b) => b.time - a.time)[0];
if (!newest) throw new Error('Aucun instantané dans data/engine.');
const network = deserializeNetwork(await readFile(join(dir, newest.name)));
// GTFS names have no commune: among homonyms, keep the station with the most platforms.
const find = (name: string) => {
  let best = -1, platforms = -1;
  network.stationNames.forEach((value, index) => {
    const count = network.stationStopOffsets[index + 1]! - network.stationStopOffsets[index]!;
    if (value.toLowerCase() === name.toLowerCase() && count > platforms) { best = index; platforms = count; }
  });
  if (best < 0) throw new Error(`Station introuvable dans l’instantané : ${name}`);
  return network.stationIds[best]!;
};
const planned = cases.map(item => ({ ...item, fromId: find(item.from), toId: find(item.to), iso: new Date(`${item.at}:00+01:00`).toISOString() }));

if (process.argv.includes('--dry-run')) {
  for (const item of planned) console.info(`${item.label} : ${item.from} (${item.fromId}) vers ${item.to} (${item.toId}), ${item.direction} ${item.at}`);
  console.info(`${planned.length} captures prévues, aucun appel PRIM fait.`);
  process.exit(0);
}

process.loadEnvFile('.env');
const apiKey = process.env.PRIM_API_KEY, limit = Number(process.env.PRIM_DAILY_LIMIT);
if (!apiKey || process.env.PRIM_QUOTA_CONFIRMED !== 'true' || !Number.isInteger(limit) || limit < 1) throw new Error('Clé PRIM et quota gratuit confirmé requis.');
const client = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const placeStation = (place: PrimJourneys['journeys'][number]['from']) => place?.stop_point?.stop_area?.id ?? place?.stop_area?.id ?? (place?.embedded_type === 'stop_area' ? place.id : undefined);
const capturedAt = new Date().toISOString(), rawDir = join('data/prim-references', capturedAt.slice(0, 10));
await mkdir(rawDir, { recursive: true });
const references = [];
let calls = 0;
for (const [index, item] of planned.entries()) {
  const reserved = await client.rpc('reserve_prim_call', { api_name: 'general', daily_limit: limit });
  if (reserved.error || !reserved.data) { console.error('Quota PRIM atteint ou compteur indisponible : arrêt.'); break; }
  calls++;
  const started = performance.now();
  const response = await fetch(primUrl({ kind: 'journey', from: item.fromId, to: item.toId, at: item.iso, direction: item.direction, freshness: 'base_schedule' }), { headers: { apiKey }, signal: AbortSignal.timeout(15_000) });
  const elapsedMs = Math.round(performance.now() - started);
  if (!response.ok) { console.error(`${item.label} : PRIM a répondu ${response.status}.`); references.push({ ...item, status: response.status, elapsedMs, journey: null }); continue; }
  const text = (await response.text()).replaceAll(apiKey, '[secret retiré]');
  await writeFile(join(rawDir, `case-${String(index + 1).padStart(2, '0')}.json`), text);
  const journey = primJourneysSchema.parse(JSON.parse(text)).journeys[0];
  references.push({
    label: item.label, fromName: item.from, toName: item.to, from: item.fromId, to: item.toId, at: item.at, direction: item.direction, status: 200, elapsedMs,
    journey: journey ? {
      departure: journey.departure_date_time, arrival: journey.arrival_date_time, duration: journey.duration,
      sections: (journey.sections ?? []).map(section => ({
        type: section.type, mode: section.mode, departure: section.departure_date_time, arrival: section.arrival_date_time,
        from: placeStation(section.from), to: placeStation(section.to), line: section.display_informations?.code, network: section.display_informations?.network,
      })),
    } : null,
  });
  console.info(`${index + 1}/${planned.length} ${item.label} : ${journey ? 'trajet reçu' : 'aucun trajet'} en ${elapsedMs} ms`);
}

const fixture = {
  provenance: {
    capturedFromPrim: true, capturedAt, source: 'PRIM IDFM/Navitia, /v2/navitia/journeys, données théoriques (base_schedule)',
    license: 'Licence Mobilités, Île-de-France Mobilités',
    description: 'Extrait fidèle du premier trajet de chaque réponse : sections, stations et horaires, heure de Paris. Réponses brutes conservées localement dans data/prim-references.',
    snapshotAtCapture: newest.name, calls,
  },
  references,
};
await mkdir('packages/transit-engine/fixtures', { recursive: true });
const out = `packages/transit-engine/fixtures/prim-references-${capturedAt.slice(0, 10)}.json`;
await writeFile(out, JSON.stringify(fixture, null, 2) + '\n');
console.info(`${calls} appels PRIM réservés et faits, extrait écrit dans ${out}.`);
