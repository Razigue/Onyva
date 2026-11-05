import { expect, it, vi } from 'vitest';
import { createPrimClient, primUrl } from '../supabase/functions/_shared/prim-client';
import type { PrimCache } from '../supabase/functions/_shared/prim-client';
import {
  arrivedAt,
  inviteFromReferrer,
  normalizeInviteCode,
  playStoreInviteUrl,
  primDateTime,
} from '@onyva/shared';
import fixture from '../packages/fairness/fixtures/navitia-contract.json';
function cache() {
  const values = new Map<string, unknown>();
  let calls = 0;
  const storage: PrimCache = {
    claim: async (key) =>
      values.has(key) ? { state: 'ready', payload: values.get(key) } : { state: 'claimed' },
    save: async (key, payload) => {
      values.set(key, payload);
    },
    reserve: async () => {
      calls++;
      return true;
    },
  };
  return { storage, calls: () => calls };
}
it('only requests a new participant isochrone while existing participant times remain cached', async () => {
  const stored = cache(),
    send = vi.fn<typeof fetch>(async () => Response.json(fixture.participants[0]!.response));
  const client = createPrimClient(stored.storage, 'test-key', send),
    at = '2026-11-02T18:30:00.000Z';
  await client.isochrone('2.36;48.86', at, 'base_schedule');
  await client.isochrone('2.39;48.85', at, 'base_schedule');
  await client.isochrone('2.36;48.86', at, 'base_schedule');
  await client.isochrone('2.39;48.85', at, 'base_schedule');
  expect(send).toHaveBeenCalledTimes(2);
  await client.isochrone('2.32;48.88', at, 'base_schedule');
  expect(send).toHaveBeenCalledTimes(3);
  expect(stored.calls()).toBe(3);
  await client.isochrone('2.36;48.86', at, 'realtime');
  expect(send).toHaveBeenCalledTimes(4);
});
it('keeps the API key server-side and refuses requests when the shared budget is exhausted', async () => {
  const stored = cache();
  stored.storage.reserve = async () => false;
  const send = vi.fn<typeof fetch>();
  await expect(
    createPrimClient(stored.storage, 'secret', send).isochrone(
      'a',
      '2026-11-02T18:30:00Z',
      'base_schedule',
    ),
  ).rejects.toThrow('Quota');
  expect(send).not.toHaveBeenCalled();
  const url = primUrl({
    kind: 'journey',
    from: 'a',
    to: 'b',
    at: '2026-11-02T18:30:00.000Z',
    direction: 'arrival',
    freshness: 'realtime',
  });
  expect(url.pathname).toBe('/marketplace/v2/navitia/journeys');
  expect(url.searchParams.get('datetime')).toBe('2026-11-02T18:30:00Z');
  expect(url.searchParams.get('datetime_represents')).toBe('arrival');
  expect(url.toString()).not.toContain('secret');
});
it('does not convert upstream errors into a route or cache fabricated data', async () => {
  const stored = cache(),
    send = vi.fn<typeof fetch>(async () => Response.json({}, { status: 429 }));
  await expect(
    createPrimClient(stored.storage, 'test', send).isochrone(
      'a',
      '2026-11-02T18:30:00Z',
      'base_schedule',
    ),
  ).rejects.toThrow('Quota');
});
it('bounds concurrent upstream requests independently of the number of candidates', async () => {
  const stored = cache();
  let active = 0, peak = 0;
  const send = vi.fn<typeof fetch>(async () => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 2));
    active--;
    return Response.json(fixture.participants[0]!.response);
  });
  const client = createPrimClient(stored.storage, 'test', send);
  await Promise.all(Array.from({length: 20}, (_, index) => client.isochrone(`station-${index}`, '2026-11-02T18:30:00Z', 'base_schedule')));
  expect(peak).toBe(6); expect(send).toHaveBeenCalledTimes(20);
});
it('handles Paris time and fails closed at ambiguous or nonexistent DST wall times', () => {
  expect(primDateTime('20261102T193000')).toBe(Date.parse('2026-11-02T18:30:00Z') / 1000);
  expect(primDateTime('20261025T023000')).toBeNull();
  expect(primDateTime('20260329T023000')).toBeNull();
});
it('recovers the Play invitation and validates user-pasted short codes without tracking parameters', () => {
  expect(normalizeInviteCode(' abcd 2345 ')).toBe('ABCD2345');
  expect(normalizeInviteCode('00000000')).toBeNull();
  expect(normalizeInviteCode('https://onyva.pages.dev/join?code=ABCD2345')).toBe('ABCD2345');
  expect(normalizeInviteCode('onyva://join?code=ABCD2345')).toBe('ABCD2345');
  expect(normalizeInviteCode('https://example.test/auth')).toBeNull();
  const url = playStoreInviteUrl(
    'https://play.google.com/store/apps/details?id=fr.onyva.app',
    'ABCD2345',
  );
  const referrer = new URL(url).searchParams.get('referrer')!;
  expect(inviteFromReferrer(referrer)).toBe('ABCD2345');
  expect(inviteFromReferrer('utm_source=something')).toBeNull();
  expect(() => playStoreInviteUrl('https://example.org', 'ABCD2345')).toThrow();
});
it('detects arrival locally without storing a position', () => {
  const venue = { latitude: 48.86, longitude: 2.36 };
  expect(arrivedAt(venue, venue)).toBe(true);
  expect(arrivedAt({ latitude: 48.87, longitude: 2.36 }, venue)).toBe(false);
});
