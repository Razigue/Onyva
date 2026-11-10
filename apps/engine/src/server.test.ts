import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { engineErrorSchema, engineMetaSchema, journeysResponseSchema, oneToAllResponseSchema } from '@onyva/shared/engine';
import { compileNetwork, serializeNetwork } from '@onyva/transit-engine';
import { paris, syntheticSource } from '../../../packages/transit-engine/src/synthetic.ts';
import type { SyntheticFeed } from '../../../packages/transit-engine/src/synthetic.ts';
import { EnginePool, TaskTimeoutError } from './pool.ts';
import { createEngineServer } from './server.ts';
import type { EngineState } from './server.ts';
import { shareSnapshot } from './snapshot.ts';

// Synthetic network: invented stations, lines and times, never the real IDFM network.
const id = (station: string) => `stop_area:IDFM:${station}`;
const MONDAY = '2026-11-09';
const feed: SyntheticFeed = {
  stations: [{ id: 'IDFM:1' }, { id: 'IDFM:2' }, { id: 'IDFM:3' }, { id: 'IDFM:9' }],
  routes: [{ id: 'R1', name: '1' }],
  trips: [
    { id: 't1', route: 'R1', service: 'WK', stops: [['IDFM:11', '08:00:00'], ['IDFM:21', '08:10:00'], ['IDFM:31', '08:20:00']] },
    { id: 't2', route: 'R1', service: 'WK', stops: [['IDFM:11', '08:30:00'], ['IDFM:21', '08:40:00'], ['IDFM:31', '08:50:00']] },
  ],
  calendar: [{ service: 'WK', days: '1111100' }],
};
const SECRET = 'test-secret-synthetique-0123456789abcdef';
const auth = { authorization: `Bearer ${SECRET}`, 'content-type': 'application/json' };

let server: Server, base = '', state: EngineState | null = null;
const logs: Array<{ route: string; status: number }> = [];

beforeAll(async () => {
  const network = await compileNetwork(syntheticSource(feed), { feedSha256: 'synthetic', builtAt: '2026-11-06T00:00:00.000Z' });
  const snapshot = shareSnapshot(serializeNetwork(network));
  const pool = new EnginePool(snapshot.bytes, { size: 2 });
  await pool.ready();
  state = { snapshot: snapshot.id, meta: snapshot.meta, pool };
  server = createEngineServer({ secret: SECRET, state: () => state, log: entry => logs.push(entry) });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
  await state?.pool.close();
});

const post = (path: string, body: unknown, headers: Record<string, string> = auth) => fetch(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });

describe('engine service', () => {
  it('reports health without a token, meta only with it', async () => {
    expect(await (await fetch(`${base}/health`)).json()).toEqual({ status: 'ok', snapshot: '1-synthetic' });
    expect((await fetch(`${base}/v1/meta`)).status).toBe(401);
    const meta = engineMetaSchema.parse(await (await fetch(`${base}/v1/meta`, { headers: auth })).json());
    expect(meta).toMatchObject({ snapshot: '1-synthetic', stations: 4, trips: 2 });
  });

  it('refuses a wrong or missing token', async () => {
    const one = { origin: id('1'), arriveBy: paris(MONDAY, '08:45') };
    expect((await post('/v1/one-to-all', one, { 'content-type': 'application/json' })).status).toBe(401);
    const wrong = await post('/v1/one-to-all', one, { authorization: `Bearer ${SECRET}x`, 'content-type': 'application/json' });
    expect(wrong.status).toBe(401);
    expect(engineErrorSchema.parse(await wrong.json()).error).toBe('unauthorized');
  });

  it('answers one-to-all with the 2 h default window and the snapshot', async () => {
    const response = await post('/v1/one-to-all', { origin: id('1'), arriveBy: paris(MONDAY, '08:45') });
    expect(response.status).toBe(200);
    const body = oneToAllResponseSchema.parse(await response.json());
    expect(body.snapshot).toBe('1-synthetic');
    expect(Object.fromEntries(body.durations.map(entry => [entry.stationId, entry.duration]))).toEqual({ [id('1')]: 0, [id('2')]: 15 * 60, [id('3')]: 45 * 60 });
    expect(body.unreachable).toBe(1);
  });

  it('keeps the batch order across threads and explains missing journeys', async () => {
    const items = Array.from({ length: 9 }, (_, i) => ({ key: `k${i}`, from: id('1'), to: i % 3 === 2 ? id('9') : id(String(2 + (i % 2))), time: paris(MONDAY, '07:50'), direction: 'departAfter' as const }));
    const body = journeysResponseSchema.parse(await (await post('/v1/journeys', { items })).json());
    expect(body.results.map(result => result.key)).toEqual(items.map(item => item.key));
    expect(body.results[0]).toMatchObject({ status: 'ok', journey: { arrival: paris(MONDAY, '08:10'), transfers: 0 } });
    expect(body.results[2]).toEqual({ key: 'k2', status: 'none', reason: 'no-service' });
    const transit = body.results[1]!.status === 'ok' ? body.results[1]!.journey.legs.find(leg => leg.mode === 'transit') : undefined;
    expect(transit).toMatchObject({ routeId: 'R1', stations: [id('1'), id('2'), id('3')] });
  });

  it('maps errors to the contract codes', async () => {
    const at = paris(MONDAY, '08:45');
    expect((await post('/v1/one-to-all', { origin: 'IDFM:1', arriveBy: at })).status).toBe(400);
    expect((await post('/v1/one-to-all', { origin: id('1'), arriveBy: at, window: 5 * 3600 })).status).toBe(400);
    const unknown = await post('/v1/one-to-all', { origin: id('404'), arriveBy: at });
    expect([unknown.status, (await unknown.json()).error]).toEqual([400, 'unknown-station']);
    const outside = await post('/v1/one-to-all', { origin: id('1'), arriveBy: paris('2026-12-25', '20:00') });
    expect(outside.status).toBe(422);
    expect(await outside.json()).toMatchObject({ error: 'out-of-validity', validFrom: '2026-11-02', validUntil: '2026-12-04' });
    const item = { from: id('1'), to: id('2'), time: at, direction: 'arriveBy' };
    expect((await post('/v1/journeys', { items: Array.from({ length: 65 }, (_, i) => ({ key: `k${i}`, ...item })) })).status).toBe(413);
    expect((await post('/v1/journeys', { items: [{ key: 'a', ...item }, { key: 'a', ...item }] })).status).toBe(400);
    expect((await post('/v1/one-to-all', { origin: id('1'), arriveBy: at, targets: Array.from({ length: 20_000 }, () => id('123456789')) })).status).toBe(413);
    expect((await fetch(`${base}/v1/one-to-all`, { method: 'POST', headers: auth, body: '{' })).status).toBe(400);
    expect((await fetch(`${base}/v2/secret`, { headers: auth })).status).toBe(404);
  });

  it('compresses large answers on request', async () => {
    const response = await fetch(`${base}/v1/one-to-all`, { method: 'POST', headers: { ...auth, 'accept-encoding': 'gzip' }, body: JSON.stringify({ origin: id('1'), arriveBy: paris(MONDAY, '08:45') }) });
    expect(response.status).toBe(200);
    expect(oneToAllResponseSchema.parse(await response.json()).durations.length).toBe(3);
  });

  it('answers 503 while no snapshot is loaded', async () => {
    const saved = state;
    state = null;
    try {
      expect((await fetch(`${base}/health`)).status).toBe(503);
      expect((await post('/v1/one-to-all', { origin: id('1'), arriveBy: paris(MONDAY, '08:45') })).status).toBe(503);
    } finally { state = saved; }
  });

  it('logs only the route, the status and the duration', () => {
    expect(logs.length).toBeGreaterThan(0);
    for (const entry of logs) expect(Object.keys(entry).sort()).toEqual(['ms', 'route', 'snapshot', 'status']);
    expect(logs.some(entry => entry.route === 'other' && entry.status === 404)).toBe(true);
  });
});

describe('engine pool', () => {
  it('rejects a task past its deadline and replaces the stuck thread', async () => {
    const pool = new EnginePool(new Uint8Array(new SharedArrayBuffer(8)), { size: 1, workerUrl: new URL('../test/hang-worker.mjs', import.meta.url) });
    await pool.ready();
    await expect(pool.run({ kind: 'journeys', items: [] }, 50)).rejects.toBeInstanceOf(TaskTimeoutError);
    expect(pool.size).toBe(1);
    await expect(pool.run({ kind: 'journeys', items: [] }, 50)).rejects.toBeInstanceOf(TaskTimeoutError);
    await pool.close();
  });
});
