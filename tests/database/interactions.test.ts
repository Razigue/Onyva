import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { outingSchema, pushJobSchema, venueReactionsSchema } from '@onyva/shared';

const db = new PGlite();
const owner = '00000000-0000-4000-8000-000000000001';
const guest = '00000000-0000-4000-8000-000000000002';
const stranger = '00000000-0000-4000-8000-000000000003';
let id: string;
async function asUser(user: string) { await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub = '${user}';`); }
async function rpc(name: string, args: unknown[] = []) {
  return (await db.query<{ result: unknown }>(`select public.${name}(${args.map((_, index) => `$${index + 1}`).join(',')}) as result`, args)).rows[0]!.result;
}
async function confirm() { await asUser(owner); await rpc('confirm_venue', [id, 'a']); }
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to authenticated;
    insert into auth.users values ('${owner}'),('${guest}'),('${stranger}');`);
  for (const file of ['0000_glorious_maverick.sql', '0001_security.sql', '0002_invitation_preview.sql', '0003_normal_krista_starr.sql', '0004_outing_interactions.sql']) {
    await db.exec((await readFile(`supabase/migrations/${file}`, 'utf8')).split('create extension if not exists pg_cron')[0]!);
  }
  await db.exec(`insert into public.stations values('a','Bastille',2.369,48.853,'["5"]');`);
});
beforeEach(async () => {
  await db.exec('reset role; delete from public.outings;');
  await asUser(owner);
  const outing = outingSchema.parse(await rpc('create_outing', [JSON.stringify({ name: 'Yanis', startsAt: new Date(Date.now() + 86400_000).toISOString(), endsAt: new Date(Date.now() + 95_400_000).toISOString(), activity: 'dinner', departureId: 'a' })]));
  id = outing.id;
  await asUser(guest);
  await rpc('join_outing', [JSON.stringify({ inviteCode: outing.inviteCode, name: 'Inès', departureId: 'a', returnId: 'a' })]);
  await db.exec('reset role');
  await db.query('update public.outings set recommendations = $1 where id = $2', [JSON.stringify({ computedAt: new Date().toISOString(), recommendations: [{ venue: { id: 'a', name: 'Café réel' } }, { venue: { id: 'b', name: 'Autre café' } }] }), id]);
});
afterAll(() => db.close());

it('lets members like server candidates once, undo their own reaction, and closes voting on confirmation', async () => {
  await asUser(guest);
  expect(venueReactionsSchema.parse(await rpc('set_venue_reaction', [id, 'a', true]))).toEqual([{ venueId: 'a', userId: guest }]);
  expect(venueReactionsSchema.parse(await rpc('set_venue_reaction', [id, 'a', true]))).toHaveLength(1);
  await expect(rpc('set_venue_reaction', [id, 'fake', true])).rejects.toThrow('Unknown venue');
  await asUser(owner); await rpc('set_venue_reaction', [id, 'a', true]);
  await asUser(guest);
  expect(venueReactionsSchema.parse(await rpc('set_venue_reaction', [id, 'a', false]))).toEqual([{ venueId: 'a', userId: owner }]);
  await confirm();
  await expect(rpc('set_venue_reaction', [id, 'a', true])).rejects.toThrow('Voting closed');
});
it('isolates reactions and device tokens and rejects direct writes and queue claims by members', async () => {
  await asUser(guest); await rpc('set_venue_reaction', [id, 'a', true]); await rpc('register_outing_push', [id, 'ExpoPushToken[guest]']);
  await asUser(owner);
  expect((await db.query('select token from public.outing_push_subscriptions')).rows).toEqual([]);
  await expect(rpc('claim_push_jobs')).rejects.toThrow();
  await expect(db.exec(`update public.outing_push_subscriptions set state = 'sent'`)).rejects.toThrow();
  await asUser(stranger);
  expect((await db.query('select * from public.venue_reactions')).rows).toEqual([]);
  await expect(rpc('get_venue_reactions', [id])).rejects.toThrow('Not a member');
  await expect(rpc('register_outing_push', [id, 'ExpoPushToken[stranger]'])).rejects.toThrow('Not a member');
});
it('validates tokens, limits devices, and queues confirmation atomically with leased retries', async () => {
  await asUser(guest);
  await expect(rpc('register_outing_push', [id, 'invalid'])).rejects.toThrow();
  for (let i = 0; i < 3; i++) await rpc('register_outing_push', [id, `ExpoPushToken[device${i}]`]);
  await rpc('register_outing_push', [id, 'ExpoPushToken[device0]']);
  await expect(rpc('register_outing_push', [id, 'ExpoPushToken[device3]'])).rejects.toThrow('Device limit');
  await db.exec('reset role; set role service_role;');
  expect(await rpc('claim_push_jobs')).toEqual([]);
  await confirm();
  await db.exec('reset role; set role service_role;');
  const jobs = pushJobSchema.array().parse(await rpc('claim_push_jobs'));
  expect(jobs).toHaveLength(3); expect(jobs[0]).toMatchObject({ outingId: id, venueName: 'Café réel', attempts: 1 });
  expect(await rpc('claim_push_jobs')).toEqual([]);
  await db.exec(`update public.outing_push_subscriptions set available_at = now() - interval '1 minute';`);
  expect(pushJobSchema.array().parse(await rpc('claim_push_jobs'))[0]?.attempts).toBe(2);
  await db.exec(`update public.outing_push_subscriptions set available_at = now() - interval '1 minute', attempts = 3;`);
  expect(await rpc('claim_push_jobs')).toEqual([]);
  expect((await db.query("select state from public.outing_push_subscriptions where state <> 'failed'")).rows).toEqual([]);
});
it('revokes only the signed-in device owner and cascades interaction data with membership and expiry', async () => {
  await asUser(guest); await rpc('register_outing_push', [id, 'ExpoPushToken[guest]']); await rpc('set_venue_reaction', [id, 'a', true]);
  await asUser(owner); await rpc('unregister_push_token', ['ExpoPushToken[guest]']);
  await db.exec('reset role;');
  expect((await db.query('select * from public.outing_push_subscriptions')).rows).toHaveLength(1);
  await db.query('delete from public.participants where outing_id = $1 and user_id = $2', [id, guest]);
  expect((await db.query('select * from public.outing_push_subscriptions')).rows).toHaveLength(0);
  expect((await db.query('select * from public.venue_reactions')).rows).toHaveLength(0);
  await asUser(owner); await rpc('register_outing_push', [id, 'ExpoPushToken[owner]']); await rpc('set_venue_reaction', [id, 'a', true]);
  await db.exec('reset role;');
  await db.query("update public.outings set starts_at = now() - interval '27 hours', ends_at = now() - interval '25 hours' where id = $1", [id]);
  await asUser(owner);
  expect((await db.query('select * from public.outing_push_subscriptions')).rows).toHaveLength(0);
  await db.exec("reset role; delete from public.outings where ends_at + interval '24 hours' <= now();");
  expect((await db.query('select * from public.outing_push_subscriptions')).rows).toHaveLength(0);
  expect((await db.query('select * from public.venue_reactions')).rows).toHaveLength(0);
});
it('clears reactions when a group change invalidates recommendations', async () => {
  await asUser(guest); await rpc('set_venue_reaction', [id, 'a', true]);
  await asUser(owner); await rpc('add_participant', [id, 'Ami', 'a', 'a']);
  expect(await rpc('get_venue_reactions', [id])).toEqual([]);
});
