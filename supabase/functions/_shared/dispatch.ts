import { z } from 'zod';
import {
  expoPushResultSchema,
  formatTime,
  pushJobSchema,
} from '../../../packages/shared/src/index.ts';

type Job = z.infer<typeof pushJobSchema>;
type Update = {
  state: 'pending' | 'ticket' | 'sent' | 'failed';
  available_at?: string;
  ticket_id?: string;
  ticket_at?: string;
};
export type PushQueue = {
  claim: () => Promise<unknown>;
  update: (id: string, patch: Update) => Promise<void>;
  removeToken: (token: string) => Promise<void>;
  receipts: () => Promise<{ id: string; token: string; ticket_id: string; ticket_at: string }[]>;
};

// Only aggregate counts are returned to the caller; tokens and outing data are never logged.
export async function dispatchPush(
  queue: PushQueue,
  send: typeof fetch = fetch,
  accessToken?: string,
  now = Date.now(),
) {
  const headers = {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
  const retry = async (job: Job) =>
    queue.update(job.id, {
      state: job.attempts >= 3 ? 'failed' : 'pending',
      available_at: new Date(now + 2 ** job.attempts * 60_000).toISOString(),
    });
  const jobs = z.array(pushJobSchema).max(50).parse(await queue.claim());
  let accepted = 0, delivered = 0;
  if (jobs.length) {
    let results: z.infer<typeof expoPushResultSchema>[] | null = null;
    let permanent = false;
    try {
      const response = await send('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify(jobs.map((job) => ({
          to: job.token,
          title: 'Le rendez-vous est pris !',
          body: `${job.venueName} à ${formatTime(job.startsAt)}. Retrouve ton trajet dans Onyva.`,
          data: { kind: 'venue-confirmed', outingId: job.outingId },
          channelId: 'outings',
          ttl: 3600,
        }))),
      });
      permanent = response.status >= 400 && response.status < 500 && response.status !== 429;
      if (response.ok) {
        results =
          z.object({ data: z.array(expoPushResultSchema) }).parse(await response.json()).data;
      }
    } catch { /* The lease remains recoverable if the worker is interrupted. */ }
    for (const [index, job] of jobs.entries()) {
      const result = results?.[index];
      if (result?.status === 'ok' && result.id) {
        await queue.update(job.id, {
          state: 'ticket',
          ticket_id: result.id,
          ticket_at: new Date(now).toISOString(),
        });
        accepted++;
      } else if (result?.status === 'error' && result.details?.error === 'DeviceNotRegistered') {
        await queue.removeToken(job.token);
      } else if (
        permanent || (result?.status === 'error' && result.details?.error !== 'MessageRateExceeded')
      ) {
        await queue.update(job.id, { state: 'failed' });
      } else await retry(job);
    }
  }
  const tickets = await queue.receipts();
  const eligible = [];
  for (const ticket of tickets) {
    const age = now - Date.parse(ticket.ticket_at);
    if (age >= 24 * 3600_000) await queue.update(ticket.id, { state: 'failed' });
    else if (age >= 15 * 60_000) eligible.push(ticket);
  }
  if (eligible.length) {
    let receipts: Record<string, z.infer<typeof expoPushResultSchema>> = {};
    try {
      const response = await send('https://exp.host/--/api/v2/push/getReceipts', {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({ ids: eligible.map((t) => t.ticket_id) }),
      });
      if (response.ok) {
        receipts =
          z.object({ data: z.record(expoPushResultSchema) }).parse(await response.json()).data;
      }
    } catch { /* The next scheduled run will retry receipt retrieval. */ }
    for (const ticket of eligible) {
      const receipt = receipts[ticket.ticket_id];
      if (!receipt) continue;
      if (receipt.status === 'error' && receipt.details?.error === 'DeviceNotRegistered') {
        await queue.removeToken(ticket.token);
        continue;
      }
      await queue.update(ticket.id, { state: receipt.status === 'ok' ? 'sent' : 'failed' });
      if (receipt.status === 'ok') delivered++;
    }
  }
  return { claimed: jobs.length, accepted, delivered };
}
