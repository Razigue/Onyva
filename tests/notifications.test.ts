import { expect, it, vi } from 'vitest';
import { dispatchPush } from '../supabase/functions/_shared/dispatch';
import type { PushQueue } from '../supabase/functions/_shared/dispatch';

const now = Date.parse('2026-11-02T12:00:00Z');
const job = { id: '00000000-0000-4000-8000-000000000001', token: 'ExpoPushToken[test]', outingId: '00000000-0000-4000-8000-000000000002', venueName: 'Café réel', startsAt: '2026-11-02T18:30:00Z', attempts: 1 };
function queue(jobs: unknown[] = [job]): PushQueue {
  return { claim: vi.fn(async () => jobs), update: vi.fn(async () => undefined), removeToken: vi.fn(async () => undefined), receipts: vi.fn(async () => []) };
}
const respond = (body: unknown, status = 200) => vi.fn<typeof fetch>(async () => Response.json(body, { status }));

it('sends only confirmed queue jobs with minimal navigation data and saves Expo ticket IDs', async () => {
  const storage = queue(); const send = respond({ data: [{ status: 'ok', id: 'ticket' }] });
  expect(await dispatchPush(storage, send, undefined, now)).toEqual({ claimed: 1, accepted: 1, delivered: 0 });
  const body = JSON.parse(String(send.mock.calls[0]![1]!.body));
  expect(body[0].body).toContain('19:30');
  expect(body[0].data).toEqual({ kind: 'venue-confirmed', outingId: job.outingId });
  expect(storage.update).toHaveBeenCalledWith(job.id, { state: 'ticket', ticket_id: 'ticket', ticket_at: new Date(now).toISOString() });
  const empty = respond({}); await dispatchPush(queue([]), empty, undefined, now); expect(empty).not.toHaveBeenCalled();
});
it('backs off on transient failure, caps retries and treats malformed responses as recoverable', async () => {
  const storage = queue();
  await dispatchPush(storage, respond({}, 503), undefined, now);
  expect(storage.update).toHaveBeenCalledWith(job.id, { state: 'pending', available_at: new Date(now + 120_000).toISOString() });
  const exhausted = queue([{ ...job, attempts: 3 }]);
  await dispatchPush(exhausted, respond({ data: [] }), undefined, now);
  expect(exhausted.update).toHaveBeenCalledWith(job.id, expect.objectContaining({ state: 'failed' }));
});
it('removes invalid tokens and stops retrying permanent credential errors', async () => {
  const storage = queue();
  await dispatchPush(storage, respond({ data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }] }), undefined, now);
  expect(storage.removeToken).toHaveBeenCalledWith(job.token);
  const credentials = queue(); await dispatchPush(credentials, respond({}, 400), undefined, now);
  expect(credentials.update).toHaveBeenCalledWith(job.id, { state: 'failed' });
});
it('checks delayed receipts, distinguishes provider acceptance and removes revoked devices', async () => {
  const storage = queue([]);
  storage.receipts = async () => [
    { id: 'a', token: job.token, ticket_id: 'accepted', ticket_at: new Date(now - 16 * 60_000).toISOString() },
    { id: 'b', token: job.token, ticket_id: 'revoked', ticket_at: new Date(now - 16 * 60_000).toISOString() },
    { id: 'c', token: job.token, ticket_id: 'expired', ticket_at: new Date(now - 25 * 3600_000).toISOString() },
  ];
  const send = respond({ data: { accepted: { status: 'ok' }, revoked: { status: 'error', details: { error: 'DeviceNotRegistered' } } } });
  expect((await dispatchPush(storage, send, undefined, now)).delivered).toBe(1);
  expect(storage.update).toHaveBeenCalledWith('a', { state: 'sent' });
  expect(storage.update).toHaveBeenCalledWith('c', { state: 'failed' });
  expect(storage.removeToken).toHaveBeenCalledWith(job.token);
});
