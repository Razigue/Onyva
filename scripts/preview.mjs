import { spawn } from 'node:child_process';
const child = spawn('pnpm', ['exec', 'tsx', 'scripts/prepare-preview.ts'], { stdio: 'inherit', env: { ...process.env, TZ: 'Europe/Paris' } });
child.on('exit', code => { process.exitCode = code ?? 1; });
