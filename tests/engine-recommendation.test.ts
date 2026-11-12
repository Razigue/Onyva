import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compileNetwork, serializeNetwork } from '@onyva/transit-engine';
import type { Outing, RecommendationResponse, Station, Venue } from '@onyva/shared';
import { timetableLimit } from '@onyva/shared';
import { paris, syntheticSource } from '../packages/transit-engine/src/synthetic.ts';
import type { SyntheticFeed } from '../packages/transit-engine/src/synthetic.ts';
import { EnginePool } from '../apps/engine/src/pool.ts';
import { createEngineServer } from '../apps/engine/src/server.ts';
import type { EngineState } from '../apps/engine/src/server.ts';
import { shareSnapshot } from '../apps/engine/src/snapshot.ts';
import { createEngineClient, engineConfig, TransitError } from '../supabase/functions/_shared/engine-client.ts';
import type { EngineCache } from '../supabase/functions/_shared/engine-client.ts';
import { calculateSelectedVenue, engineRouter } from '../supabase/functions/_shared/recommendation.ts';
import type { RecommendationServices } from '../supabase/functions/_shared/recommendation.ts';

// Synthetic network: invented stations, lines and times, never the real IDFM network.
// Line 1 runs 1 → 2 → 3 in the morning and 3 → 2 → 1 back; station 9 has no service.
const id = (station: string) => `stop_area:IDFM:${station}`;
const MONDAY = '2026-11-09';
const feed: SyntheticFeed = {
  stations: [{ id: 'IDFM:1' }, { id: 'IDFM:2' }, { id: 'IDFM:3' }, { id: 'IDFM:9' }],
  routes: [{ id: 'R1', name: '1', type: 1 }],
  trips: [
    { id: 'out', route: 'R1', service: 'WK', stops: [['IDFM:11', '08:00:00'], ['IDFM:21', '08:10:00'], ['IDFM:31', '08:20:00']] },
    { id: 'back', route: 'R1', service: 'WK', stops: [['IDFM:31', '09:00:00'], ['IDFM:21', '09:10:00'], ['IDFM:11', '09:20:00']] },
  ],
  calendar: [{ service: 'WK', days: '1111100' }],
};
const SECRET = 'test-secret-synthetique-0123456789abcdef';
let server: Server, base = '', state: EngineState | null = null;

beforeAll(async () => {
  const network = await compileNetwork(syntheticSource(feed), { feedSha256: 'synthetic', builtAt: '2026-11-06T00:00:00.000Z' });
  const snapshot = shareSnapshot(serializeNetwork(network));
  const pool = new EnginePool(snapshot.bytes, { size: 2 });
  await pool.ready();
  state = { snapshot: snapshot.id, meta: snapshot.meta, pool };
  server = createEngineServer({ secret: SECRET, state: () => state, log: () => undefined });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
  await state?.pool.close();
});

const startsAt = new Date(paris(MONDAY, '08:25') * 1000).toISOString(), endsAt = new Date(paris(MONDAY, '08:55') * 1000).toISOString();
const venue: Venue = {
  id: 'osm:node:42', name: 'Lieu synthétique', stationId: id('3'), neighborhood: 'Test', kind: 'drinks', cuisines: [],
  walkSeconds: 120, longitude: 2.35, latitude: 48.852, source: 'osm', openIntervals: [{ start: 0, end: 4_000_000_000 }],
};
const stations: Station[] = ['1', '2', '3', '9'].map((n, i) => ({ id: id(n), name: `Station ${n}`, longitude: 2.35, latitude: 48.85 + i / 1000, lines: [] }));
const outing = (returns: [string, string]): Outing => ({
  id: '00000000-0000-4000-8000-000000000001', ownerId: 'owner', inviteCode: '00000000-0000-4000-8000-000000000002', mode: 'live',
  startsAt, endsAt, activity: 'drinks', updatedAt: startsAt, confirmedVenueId: null, selectedVenue: venue,
  participants: [
    { id: 'a', name: 'A', userId: null, departureId: id('1'), returnId: id(returns[0]) },
    { id: 'b', name: 'B', userId: null, departureId: id('2'), returnId: id(returns[1]) },
  ],
});
function services(): RecommendationServices & { saved: RecommendationResponse[] } {
  const saved: RecommendationResponse[] = [];
  return {
    saved,
    router: engineRouter(createEngineClient({ url: base, secret: SECRET }, null)),
    stations: async () => stations,
    venues: async () => [venue],
    save: async value => { saved.push(value); return true; },
  };
}

describe('engine provider, end to end on a synthetic network', () => {
  it('verifies a selected venue with the walk added on both sides', async () => {
    const result = await calculateSelectedVenue(outing(['1', '2']), services());
    expect(result).toMatchObject({ source: 'gtfs', progress: { stage: 'complete' } });
    const [recommendation] = result.recommendations;
    expect(recommendation).toMatchObject({ maximum: 25 * 60, sum: 40 * 60, spread: 10 * 60 });
    const a = recommendation!.journeys.find(j => j.participantId === 'a')!;
    expect(a.outbound.legs.map(leg => leg.mode)).toEqual(['transit', 'walk', 'wait']);
    expect(a.outbound.legs[0]).toMatchObject({ line: '1', fromName: 'Station IDFM:1', toName: 'Station IDFM:3' });
    // Return: 2 min walk from 08:55, train at 09:00, home at 09:20.
    expect(a.inbound).toMatchObject({ departure: paris(MONDAY, '08:55'), arrival: paris(MONDAY, '09:20'), duration: 25 * 60 });
    expect(result.warnings.join(' ')).toContain('Horaires théoriques');
  });

  it('refuses the venue when one participant cannot get back', async () => {
    const result = await calculateSelectedVenue(outing(['1', '9']), services());
    expect(result.recommendations).toEqual([]);
    expect(result.progress?.stage).toBe('complete');
  });

  it('explains a date beyond the published timetable instead of computing for now', async () => {
    const late = { ...outing(['1', '2']), startsAt: '2027-01-11T07:25:00.000Z', endsAt: '2027-01-11T07:55:00.000Z' };
    const result = await calculateSelectedVenue(late, services());
    expect(result.progress?.stage).toBe('failed');
    expect(result.warnings[0]).toMatch(/^Les horaires sont publiés jusqu’au \d+ décembre\./);
  });
});

describe('engine client', () => {
  it('accepts HTTPS, or HTTP on the same machine, with a long secret only', () => {
    expect(engineConfig('https://engine.example.org/', SECRET)).toEqual({ url: 'https://engine.example.org', secret: SECRET, concurrency: 4, timeoutMs: 5000 });
    expect(engineConfig('https://engine.example.org/', SECRET, '4', '20000')?.timeoutMs).toBe(20000);
    expect(engineConfig('https://engine.example.org/', SECRET, '4', '999999')?.timeoutMs).toBe(5000);
    expect(engineConfig('https://engine.example.org/', SECRET, '2')?.concurrency).toBe(2);
    expect(engineConfig('https://engine.example.org/', SECRET, 'x')?.concurrency).toBe(4);
    expect(engineConfig('http://127.0.0.1:8787', SECRET)).not.toBeNull();
    expect(engineConfig('http://engine.example.org', SECRET)).toBeNull();
    expect(engineConfig('https://engine.example.org', 'short')).toBeNull();
    expect(engineConfig(undefined, SECRET)).toBeNull();
  });

  it('reads the timetable period and rejects a wrong secret with a generic message', async () => {
    expect(await createEngineClient({ url: base, secret: SECRET }, null).meta()).toMatchObject({ validUntil: '2026-12-04' });
    await expect(createEngineClient({ url: base, secret: 'x'.repeat(40) }, null).meta()).rejects.toThrow(TransitError);
  });

  it('reuses a cached isochrone instead of asking the engine again', async () => {
    const values = new Map<string, unknown>();
    const cache: EngineCache = {
      claim: async key => values.has(key) ? { state: 'ready', payload: values.get(key) } : { state: 'claimed' },
      save: async (key, payload) => { values.set(key, payload); },
    };
    const send = vi.fn<typeof fetch>((input, init) => fetch(input, init));
    const client = createEngineClient({ url: base, secret: SECRET }, cache, send);
    const first = await client.oneToAll(id('1'), paris(MONDAY, '08:25'));
    expect(first).toContainEqual({ stationId: id('3'), duration: 25 * 60 });
    expect(await client.oneToAll(id('1'), paris(MONDAY, '08:25'))).toEqual(first);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('never sends more isochrones at once than the engine has threads', async () => {
    let running = 0, peak = 0;
    const send = vi.fn<typeof fetch>(async (input, init) => {
      running++; peak = Math.max(peak, running);
      try { return await fetch(input, init); } finally { running--; }
    });
    const client = createEngineClient({ url: base, secret: SECRET, concurrency: 2 }, null, send);
    await Promise.all(['1', '2', '3', '1', '2'].map((station, i) => client.oneToAll(id(station), paris(MONDAY, '08:25') + i)));
    expect(send).toHaveBeenCalledTimes(5);
    expect(peak).toBe(2);
  });

  it('reports a journey only possible on demand', async () => {
    const client = {
      oneToAll: vi.fn(), meta: vi.fn(),
      journeys: vi.fn(async () => ({ snapshot: 's', results: [
        { key: 'out-0', status: 'none' as const, reason: 'on-demand-only' as const },
        { key: 'back-0', status: 'none' as const, reason: 'no-service' as const },
      ] })),
    };
    const check = await engineRouter(client).verify(venue, outing(['1', '2']).participants.slice(0, 1), { startsAt: 0, endsAt: 1 }, () => stations[0]!);
    expect(check).toEqual({ journeys: [], onDemandOnly: true });
  });
});

describe('timetableLimit', () => {
  it('blocks an outing that ends after the last published Paris day', () => {
    expect(timetableLimit({ validUntil: '2026-12-09' }, new Date('2026-12-09T22:30:00Z'))).toBeNull();
    expect(timetableLimit({ validUntil: '2026-12-09' }, new Date('2026-12-09T23:30:00Z'))).toBe('Les horaires sont publiés jusqu’au 9 décembre. Choisis une date plus proche.');
    expect(timetableLimit({}, new Date('2030-01-01T00:00:00Z'))).toBeNull();
    expect(timetableLimit(null, new Date('2030-01-01T00:00:00Z'))).toBeNull();
  });
});
