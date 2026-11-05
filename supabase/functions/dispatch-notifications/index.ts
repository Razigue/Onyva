import { createClient } from '@supabase/supabase-js';
import { dispatchPush } from '../_shared/dispatch.ts';

async function sameSecret(actual: string, expected: string) {
  const digest = (value: string) =>
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const a = new Uint8Array(await digest(actual)), b = new Uint8Array(await digest(expected));
  return a.reduce((different, byte, index) => different | (byte ^ b[index]!), 0) === 0;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  const secret = Deno.env.get('NOTIFICATIONS_SECRET');
  if (!secret || secret.length < 32) {
    return Response.json({ error: 'Dispatcher not configured' }, { status: 503 });
  }
  if (!await sameSecret(request.headers.get('Authorization') ?? '', `Bearer ${secret}`)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const result = await dispatchPush(
      {
        claim: async () => {
          const result = await admin.rpc('claim_push_jobs');
          if (result.error) throw new Error('Queue unavailable');
          return result.data;
        },
        update: async (id, patch) => {
          const result = await admin.from('outing_push_subscriptions').update(patch).eq('id', id);
          if (result.error) throw new Error('Queue update failed');
        },
        removeToken: async (token) => {
          const result = await admin.from('outing_push_subscriptions').delete().eq('token', token);
          if (result.error) throw new Error('Token removal failed');
        },
        receipts: async () => {
          const result = await admin.from('outing_push_subscriptions').select(
            'id,token,ticket_id,ticket_at',
          ).eq('state', 'ticket').lte('ticket_at', new Date(Date.now() - 15 * 60_000).toISOString())
            .order('ticket_at').limit(50);
          if (result.error) throw new Error('Receipts unavailable');
          return result.data;
        },
      },
      fetch,
      Deno.env.get('EXPO_ACCESS_TOKEN'),
    );
    return Response.json(result);
  } catch {
    return Response.json({ error: 'Dispatch unavailable' }, { status: 503 });
  }
});
