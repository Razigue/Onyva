import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const container = process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_onyva';
const database = `onyva_test_${randomUUID().replaceAll('-', '')}`;
const docker = (command: string, args: string[], input?: string) =>
  execFileSync('docker', ['exec', '-i', container, command, ...args], {
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
const sql = (text: string) =>
  docker('psql', ['-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-q'], text);
try {
  docker('createdb', ['-U', 'postgres', database]);
  sql(
    `create schema vault; create schema extensions; create extension pgcrypto with schema extensions;
    create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create schema realtime;create table realtime.messages(topic text,extension text);alter table realtime.messages enable row level security;
    create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;
    grant usage on schema public,auth,realtime to authenticated;grant select on realtime.messages to authenticated;
    insert into auth.users values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002'),('00000000-0000-4000-8000-000000000003');`,
  );
  for (const file of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) {
    const text = readFileSync(`supabase/migrations/${file}`, 'utf8').split(
      'create extension if not exists pg_cron',
    )[0]!.split('select cron.schedule')[0]!;
    sql(text);
  }
  sql(readFileSync('tests/database/assertions.sql', 'utf8'));
  sql(readFileSync('tests/database/manual.sql', 'utf8'));
  console.info(
    'Tests PostgreSQL/PostGIS réussis : RLS, quotas, caches, concurrence, invitations et vérification des retours.',
  );
} catch (error) {
  const message = error instanceof Error ? error.message : 'Échec des tests SQL.';
  throw new Error(message);
} finally {
  try {
    docker('dropdb', ['-U', 'postgres', '--if-exists', database]);
  } catch { /* Preserve the original test failure. */ }
}
