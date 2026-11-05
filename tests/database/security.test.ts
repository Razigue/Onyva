import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { outingSchema } from '@onyva/shared';

const db = new PGlite();
const owner = '00000000-0000-4000-8000-000000000001';
const guest = '00000000-0000-4000-8000-000000000002';
const stranger = '00000000-0000-4000-8000-000000000003';
let outingId: string;
let code: string;
async function asUser(id: string) { await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub = '${id}';`); }
async function call(name: string, args: unknown[]) {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(',');
  const result = await db.query<{ result: unknown }>(`select public.${name}(${placeholders}) as result`, args);
  return result.rows[0]!.result;
}
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to authenticated;
    insert into auth.users values ('${owner}'), ('${guest}'), ('${stranger}');`);
  await db.exec(await readFile('supabase/migrations/0000_glorious_maverick.sql', 'utf8'));
  const security = await readFile('supabase/migrations/0001_security.sql', 'utf8');
  await db.exec(security.split('create extension if not exists pg_cron')[0]!);
  await db.exec(await readFile('supabase/migrations/0002_invitation_preview.sql', 'utf8'));
  await db.exec(`insert into public.stations values('a','Bastille',2.369,48.853,'["5"]'),('b','République',2.363,48.867,'["5"]');`);
  await asUser(owner);
  const outing = outingSchema.parse(await call('create_outing', [JSON.stringify({ name: 'Yanis', startsAt: new Date(Date.now() + 86400_000).toISOString(), endsAt: new Date(Date.now() + 95_400_000).toISOString(), activity: 'drinks', departureId: 'a' })]));
  outingId = outing.id; code = outing.inviteCode;
});
afterAll(async () => { await db.close(); });

it('creates an outing atomically and validates its shared contract', async () => {
  await asUser(owner);
  const outing = outingSchema.parse(await call('get_outing', [outingId]));
  expect(outing.ownerId).toBe(owner); expect(outing.participants).toHaveLength(1);
});
it('hides outings and participants from non-members, including direct table queries', async () => {
  await asUser(stranger);
  expect((await db.query('select * from public.outings')).rows).toEqual([]);
  expect((await db.query('select * from public.participants')).rows).toEqual([]);
  await expect(call('get_outing', [outingId])).rejects.toThrow('Not a member');
  await expect(db.exec(`update public.outings set activity = 'coffee'`)).rejects.toThrow();
});
it('exposes only a minimal preview to a holder of the invitation code', async () => {
  await asUser(stranger);
  const preview = await call('preview_invitation', [code]);
  expect(Object.keys(preview as Record<string, unknown>).sort()).toEqual(['activity', 'count', 'name', 'startsAt']);
  expect(await call('preview_invitation', ['00000000-0000-4000-8000-000000000000'])).toBeNull();
});
it('joins by invitation once and grants access only after joining', async () => {
  await asUser(guest);
  const payload = JSON.stringify({ inviteCode: code, name: 'Inès', departureId: 'b', returnId: 'a' });
  await call('join_outing', [payload]);
  const outing = outingSchema.parse(await call('join_outing', [payload]));
  expect(outing.participants).toHaveLength(2);
  expect(outing.participants.find(p => p.userId === guest)?.returnId).toBe('a');
  await expect(call('add_participant', [outingId, 'Intrus', 'a', 'a'])).rejects.toThrow();
  await expect(call('confirm_venue', [outingId, 'fake'])).rejects.toThrow();
});
it('rejects fabricated venue confirmation and enforces ten participants', async () => {
  await asUser(owner);
  await expect(call('confirm_venue', [outingId, 'fake'])).rejects.toThrow('Refresh recommendations');
  for (let i = 0; i < 8; i++) await call('add_participant', [outingId, `Ami ${i}`, 'a', 'b']);
  await expect(call('add_participant', [outingId, 'De trop', 'a', 'b'])).rejects.toThrow('Group full');
  expect(outingSchema.parse(await call('get_outing', [outingId])).participants).toHaveLength(10);
});
it('requires fresh server recommendations and invalidates them when the group changes', async () => {
  await db.exec('reset role');
  const cached = { computedAt: new Date().toISOString(), recommendations: [{ venue: { id: 'verified' } }] };
  await db.query('update public.outings set recommendations = $1 where id = $2', [JSON.stringify(cached), outingId]);
  await asUser(owner);
  const outing = outingSchema.parse(await call('get_outing', [outingId]));
  await call('remove_participant', [outingId, outing.participants[9]!.id]);
  await expect(call('confirm_venue', [outingId, 'verified'])).rejects.toThrow('Refresh recommendations');
});
it('expires member access and cascades deletion to all participants', async () => {
  await db.exec('reset role');
  await db.query(`update public.outings set starts_at = now() - interval '27 hours', ends_at = now() - interval '25 hours' where id = $1`, [outingId]);
  await asUser(owner);
  expect((await db.query('select * from public.outings')).rows).toHaveLength(0);
  await expect(call('get_outing', [outingId])).rejects.toThrow('Not a member');
  await db.exec(`reset role; delete from public.outings where ends_at + interval '24 hours' <= now();`);
  expect((await db.query('select * from public.participants')).rows).toHaveLength(0);
});
