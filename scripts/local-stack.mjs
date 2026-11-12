// Full local stack with the transit engine: web app → local Supabase → local engine. No PRIM call, no remote project.
// Your .env files are not modified. In development Expo merges the app .env files over the process environment,
// so the app target is written to apps/mobile/.env.development.local, the file with the highest priority, and removed on stop.
//   pnpm local          moteur, fonctions et application web (http://localhost:8082)
//   pnpm local --auto   même chose, avec la recherche automatique du juste milieu activée
//   pnpm local:venues   rafraîchit les lieux OSM de la base locale (horaires sur 16 jours)
//   pnpm local:stations lignes des stations de la base locale, depuis l'instantané
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const command = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'up';
const auto = process.argv.includes('--auto');

function local() {
  let status;
  try {
    status = JSON.parse(execFileSync('pnpm', ['exec', 'supabase', 'status', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch {
    throw new Error('Supabase local ne répond pas. Lance d’abord : pnpm supabase:start');
  }
  if (!status.API_URL || new URL(status.API_URL).hostname !== '127.0.0.1' || !status.ANON_KEY || !status.SERVICE_ROLE_KEY) {
    throw new Error('Supabase local introuvable. Lance d’abord : pnpm supabase:start');
  }
  return status;
}

/** Newest snapshot of data/engine, refused when the Paris date of today is outside its period. */
function snapshot() {
  const dir = 'data/engine';
  const files = existsSync(dir) ? readdirSync(dir).filter(name => /^snapshot-.+\.bin$/.test(name)) : [];
  if (!files.length) throw new Error('Aucun instantané. Télécharge le GTFS puis lance : pnpm engine:build-network');
  const newest = files.map(name => join(dir, name)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
  const meta = JSON.parse(readFileSync(newest.replace(/\.bin$/, '.json'), 'utf8'));
  const day = new Date(`${new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(new Date())}T00:00:00Z`).getTime() / 86_400_000;
  const until = new Date(meta.validUntilDay * 86_400_000).toISOString().slice(0, 10);
  if (day > meta.validUntilDay) throw new Error(`L’instantané a expiré le ${until}. Lance : scripts/engine/refresh-snapshot.sh`);
  if (meta.validUntilDay - day < 7) console.warn(`Attention : l’instantané expire le ${until}. Pense à scripts/engine/refresh-snapshot.sh`);
  return { file: newest, until };
}

/** Values kept from the functions file, never PRIM: the local stack must not share the remote PRIM counter. */
function functionSecrets() {
  const path = 'supabase/functions/.env.local', values = {};
  if (!existsSync(path)) return values;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^(NOTIFICATIONS_SECRET|LOCATION_SIGNING_SECRET)=(.*)$/.exec(line.trim());
    if (match) values[match[1]] = match[2].replace(/^"|"$/g, '');
  }
  return values;
}

function run(name, cmd, args, env) {
  // Own process group: pnpm does not forward signals, so the whole group is stopped at once.
  const child = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  const prefix = `[${name}] `;
  for (const stream of [child.stdout, child.stderr]) {
    let rest = '';
    stream.on('data', chunk => {
      const lines = (rest + chunk).split('\n');
      rest = lines.pop();
      for (const line of lines) if (line.trim()) process.stdout.write(prefix + line + '\n');
    });
  }
  return child;
}

function runOnce(cmd, args, env) {
  execFileSync(cmd, args, { env: { ...process.env, ...env }, stdio: 'inherit' });
}

const status = local();
const server = { SUPABASE_URL: status.API_URL, SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY, TZ: 'Europe/Paris' };

if (command === 'venues') {
  const file = process.env.OSM_VENUES_FILE ?? 'data/osm-regional-venues.jsonl';
  if (!existsSync(file)) throw new Error(`Extrait OSM introuvable : ${file}. Voir scripts/venues.`);
  runOnce('pnpm', ['-s', 'venues:import'], { ...server, OSM_VENUES_FILE: file });
} else if (command === 'stations') {
  runOnce('pnpm', ['-s', 'engine:import-stations', snapshot().file, '--apply'], server);
} else if (command === 'up') {
  const { file, until } = snapshot();
  const secret = randomBytes(32).toString('hex');
  // Ten isochrones on a development laptop that also runs Docker and Metro can exceed the 5 s production deadline.
  const timeout = auto ? '20000' : '5000';
  mkdirSync('data/local', { recursive: true });
  const envFile = 'data/local/functions.env';
  const values = {
    ...functionSecrets(),
    TRANSIT_PROVIDER: 'engine',
    // The functions run in Docker: the engine on this machine is reached through the Docker host.
    ENGINE_URL: 'http://host.docker.internal:8787',
    ENGINE_SECRET: secret,
    ENGINE_THREADS: '4',
    ENGINE_TIMEOUT_MS: timeout,
    RECOMMENDATIONS_ENABLED: auto ? 'true' : 'false',
    PRIM_QUOTA_CONFIRMED: 'false',
  };
  writeFileSync(envFile, Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600 });
  const appEnv = 'apps/mobile/.env.development.local', marker = '# Écrit par pnpm dev:local, supprimé à l’arrêt. Ne pas modifier.';
  if (existsSync(appEnv) && !readFileSync(appEnv, 'utf8').startsWith(marker)) {
    throw new Error(`${appEnv} existe déjà et n’a pas été écrit par pnpm dev:local. Renomme-le avant de lancer la pile locale.`);
  }
  writeFileSync(appEnv, [marker, `EXPO_PUBLIC_SUPABASE_URL=${status.API_URL}`, `EXPO_PUBLIC_SUPABASE_ANON_KEY=${status.ANON_KEY}`, 'EXPO_PUBLIC_INVITE_URL=http://localhost:4174', ''].join('\n'), { mode: 0o600 });
  // Without this file, a plain `pnpm dev` targets the remote project again.
  const restore = () => { if (existsSync(appEnv) && readFileSync(appEnv, 'utf8').startsWith(marker)) rmSync(appEnv); };
  process.on('exit', restore);
  console.info(`Instantané ${file}, horaires jusqu’au ${until}. Juste milieu automatique : ${auto ? 'activé' : 'en pause'}.`);
  const children = [
    // 0.0.0.0 so that the functions container can reach it; every route except /health needs the secret.
    run('moteur', 'pnpm', ['-s', '--filter', '@onyva/engine', 'dev'], { ENGINE_SECRET: secret, ENGINE_HOST: '0.0.0.0', ENGINE_PORT: '8787', ENGINE_THREADS: '4', ENGINE_TIMEOUT_MS: timeout, ENGINE_SNAPSHOT: join(process.cwd(), file) }),
    run('fonctions', 'pnpm', ['exec', 'supabase', 'functions', 'serve', '--env-file', envFile], {}),
    run('app', 'pnpm', ['-s', '--filter', 'mobile', 'dev'], { EXPO_PUBLIC_SUPABASE_URL: status.API_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY, EXPO_PUBLIC_INVITE_URL: 'http://localhost:4174' }),
  ];
  console.info('Application : http://localhost:8082 · Supabase Studio : pnpm exec supabase status · Ctrl+C pour tout arrêter.');
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    restore();
    for (const child of children) {
      try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already stopped */ }
    }
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  for (const child of children) child.on('exit', code => { if (!stopping && code) { console.error(`Un service s’est arrêté (code ${code}). Arrêt de la pile.`); stop(); } });
} else {
  throw new Error(`Commande inconnue : ${command}`);
}
