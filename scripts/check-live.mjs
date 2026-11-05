import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');
if (existsSync('apps/mobile/.env.local')) process.loadEnvFile('apps/mobile/.env.local');
const platform = process.argv[2] ?? 'all';
if (!['all', 'web', 'android', 'ios'].includes(platform)) throw new Error('Plateforme attendue : web, android, ios ou all.');
const checks = [];
async function check(name, action, required = true) {
  try {
    checks.push({ name, ready: Boolean(await action()), required });
  } catch {
    checks.push({ name, ready: false, required });
  }
}
const url = process.env.EXPO_PUBLIC_SUPABASE_URL, anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (url) {
  console.info(
    ['localhost', '127.0.0.1'].includes(new URL(url).hostname)
      ? 'Cible : intégration locale.'
      : 'Cible : Supabase distant.',
  );
}
let providers = {};
await check('Authentification Supabase', async () => {
  if (!url || !anon) return false;
  const response = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: anon },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return false;
  providers = (await response.json()).external ?? {};
  return true;
});
await check('Connexion Google', async () => providers.google === true);
await check('Connexion Apple, requise sur iOS', async () => providers.apple === true, ['all', 'ios'].includes(platform));
await check('Catalogue actif de stations PRIM', async () => {
  if (!url || !anon || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  const response = await fetch(`${url}/rest/v1/stations?select=id&active=eq.true&limit=1`, {
    headers: { apikey: anon, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
    signal: AbortSignal.timeout(10000),
  });
  return response.ok && (await response.json()).length > 0;
});
await check(
  'PRIM configuré avec quota déclaré confirmé',
  async () =>
    Boolean(process.env.PRIM_API_KEY) && Number(process.env.PRIM_DAILY_LIMIT) > 0 &&
    process.env.PRIM_QUOTA_CONFIRMED === 'true',
);
await check('Catalogue régional OSM actif', async () => {
  if (!url || !anon || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  const response = await fetch(`${url}/rest/v1/venue_imports?select=imported_at`, {
    headers: { apikey: anon, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json();
  return response.ok && data[0]?.imported_at &&
    Date.parse(data[0].imported_at) > Date.now() - 8 * 86400_000;
});
await check(
  'Droit signé du partage HTTP configuré',
  async () =>
    Boolean(process.env.LOCATION_SIGNING_SECRET) &&
    process.env.LOCATION_SIGNING_SECRET.length >= 32,
);
await check(
  'Projet natif Expo configuré',
  async () => Boolean(process.env.EXPO_PUBLIC_EAS_PROJECT_ID),
  platform !== 'web',
);
await check('Page d’invitation publique en HTTPS', async () => {
  const value = process.env.EXPO_PUBLIC_INVITE_URL;
  if (!value) return false;
  const parsed = new URL(value);
  return parsed.protocol === 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname) && (await fetch(value, { signal: AbortSignal.timeout(10000) })).ok;
});
for (const item of checks) console.info(`${item.ready ? 'PRÊT' : item.required ? 'MANQUANT' : 'EN ATTENTE'} : ${item.name}`);
console.info(
  'Quota réel, latence PRIM, connexions natives et reprise après installation : à vérifier sur les services et appareils réels.',
);
if (checks.some((item) => item.required && !item.ready)) process.exitCode = 1;
