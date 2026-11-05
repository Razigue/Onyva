import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const args = [
  'exec',
  'supabase',
  'gen',
  'types',
  'typescript',
  '--schema',
  'public',
  ...process.argv.slice(2),
];
if (!args.includes('--project-id') && !args.includes('--linked')) args.push('--local');
const generated = execFileSync('pnpm', args, {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
  // A linked project's password must not override the local development database.
  env: args.includes('--local') ? { ...process.env, SUPABASE_DB_PASSWORD: 'postgres' } : process.env,
});
if (!generated.includes('export type Database')) {
  throw new Error('La génération des types Supabase a échoué.');
}
writeFileSync('packages/shared/src/generated/database.ts', generated);
