import { createClient } from '@supabase/supabase-js';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return new Response(null, { status: 405, headers });
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return new Response(JSON.stringify({ error: 'Sign in required' }), { status: 401, headers });
  }
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const result = await admin.auth.admin.deleteUser(data.user.id);
  return new Response(
    JSON.stringify(result.error ? { error: 'Deletion failed' } : { deleted: true }),
    { status: result.error ? 500 : 200, headers },
  );
});
