import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
if (existsSync('.env')) process.loadEnvFile('.env');
const required = [
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_DB_PASSWORD',
  'SUPABASE_PROJECT_REF',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PRIM_API_KEY',
  'PRIM_DAILY_LIMIT',
  'LOCATION_SIGNING_SECRET',
  'NOTIFICATIONS_SECRET',
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`Variables de déploiement manquantes : ${missing.join(', ')}`);
if (!/^[a-z]{20}$/.test(process.env.SUPABASE_PROJECT_REF)) {
  throw new Error('Référence de projet Supabase invalide.');
}
const limit = Number(process.env.PRIM_DAILY_LIMIT);
if (
  process.env.PRIM_QUOTA_CONFIRMED !== 'true' || !Number.isInteger(limit) || limit < 1 ||
  limit > 1000000
) throw new Error('Confirme le quota gratuit PRIM avant le déploiement.');
for (const key of ['LOCATION_SIGNING_SECRET', 'NOTIFICATIONS_SECRET']) {
  if (!/^[a-zA-Z0-9_-]{32,}$/.test(process.env[key])) {
    throw new Error(`Utilise un secret aléatoire de 32 caractères minimum pour ${key}.`);
  }
}
const names = [
  'PRIM_API_KEY',
  'PRIM_DAILY_LIMIT',
  'PRIM_QUOTA_CONFIRMED',
  'LOCATION_SIGNING_SECRET',
  'NOTIFICATIONS_SECRET',
  'EXPO_ACCESS_TOKEN',
  'RECOMMENDATIONS_ENABLED',
];
for (const name of names) {
  if (/[\r\n\0]/.test(process.env[name] ?? '')) throw new Error(`Valeur invalide : ${name}.`);
}
const directory = mkdtempSync(join(tmpdir(), 'onyva-deploy-'));
const run = (args) => execFileSync('pnpm', ['exec', 'supabase', ...args], { stdio: 'inherit' });
try {
  const file = join(directory, 'functions.env');
  writeFileSync(
    file,
    names.filter((name) => process.env[name]).map((name) => `${name}=${process.env[name]}`).join(
      '\n',
    ) + '\n',
    { mode: 0o600 },
  );
  run(['link', '--project-ref', process.env.SUPABASE_PROJECT_REF]);
  run(['db', 'push', '--linked']);
  run(['secrets', 'set', '--env-file', file, '--project-ref', process.env.SUPABASE_PROJECT_REF]);
  for (const name of ['recommend', 'delete-account', 'dispatch-notifications', 'location']) {
    run([
      'functions',
      'deploy',
      name,
      '--project-ref',
      process.env.SUPABASE_PROJECT_REF,
      '--use-api',
      '--import-map',
      'supabase/functions/deno.json',
    ]);
  }
  const url = `https://${process.env.SUPABASE_PROJECT_REF}.supabase.co`;
  const client = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const result = await client.rpc('configure_notification_schedule', {
    endpoint: `${url}/functions/v1/dispatch-notifications`,
    secret: process.env.NOTIFICATIONS_SECRET,
  });
  if (result.error) {
    throw new Error('Fonctions déployées, mais planification des notifications à vérifier.');
  }
  console.info(
    'Déploiement Supabase terminé. Connexions natives et réponses PRIM réelles à vérifier.',
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
