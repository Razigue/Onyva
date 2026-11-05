import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
const status = JSON.parse(
  execFileSync('pnpm', ['exec', 'supabase', 'status', '--output', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }),
);
if (
  !status.API_URL || new URL(status.API_URL).hostname !== '127.0.0.1' || !status.ANON_KEY ||
  !status.SERVICE_ROLE_KEY
) throw new Error('Démarre Supabase local avant la configuration.');
const files = [
  '.env',
  'apps/mobile/.env.local',
  'apps/invite/.env.local',
  'supabase/functions/.env.local',
];
if (files.some(existsSync)) {
  throw new Error(
    'Les fichiers locaux existent déjà. Conserve-les et mets-les à jour depuis .env.example.',
  );
}
mkdirSync('data', { recursive: true });
const notificationsSecret = randomBytes(32).toString('hex'),
  locationSecret = randomBytes(32).toString('hex');
const writeEnv = (path, values) =>
  writeFileSync(
    path,
    Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') +
      '\n',
    { mode: 0o600 },
  );
writeEnv('.env', {
  TZ: 'Europe/Paris',
  SUPABASE_URL: status.API_URL,
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  NOTIFICATIONS_SECRET: notificationsSecret,
  LOCATION_SIGNING_SECRET: locationSecret,
  PRIM_API_KEY: '',
  PRIM_DAILY_LIMIT: '',
  PRIM_QUOTA_CONFIRMED: 'false',
});
writeEnv('apps/mobile/.env.local', {
  EXPO_PUBLIC_SUPABASE_URL: status.API_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
  EXPO_PUBLIC_INVITE_URL: 'http://localhost:4174',
});
writeEnv('apps/invite/.env.local', {
  VITE_SUPABASE_URL: status.API_URL,
  VITE_SUPABASE_ANON_KEY: status.ANON_KEY,
});
writeEnv('supabase/functions/.env.local', {
  NOTIFICATIONS_SECRET: notificationsSecret,
  LOCATION_SIGNING_SECRET: locationSecret,
  PRIM_API_KEY: '',
  PRIM_DAILY_LIMIT: '',
  PRIM_QUOTA_CONFIRMED: 'false',
});
console.info('Environnement local configuré. Google, Apple et la clé PRIM restent à renseigner.');
