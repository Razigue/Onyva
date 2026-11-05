import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// Vite loads these for the web bundle; the following Node process needs them too.
for (const file of ['.env.local', '.env']) if (existsSync(file)) process.loadEnvFile(file);

await mkdir('dist/.well-known', { recursive: true });
const apple = process.env.APPLE_APP_ID;
const android = process.env.ANDROID_CERT_FINGERPRINT;
if (apple && !/^[A-Z0-9]{10}\.fr\.onyva\.app$/.test(apple)) throw new Error('APPLE_APP_ID must be TEAMID.fr.onyva.app with a ten-character Apple team ID');
if (android && !/^(?:[A-F\d]{2}:){31}[A-F\d]{2}$/i.test(android)) throw new Error('ANDROID_CERT_FINGERPRINT must be the SHA-256 signing certificate fingerprint');
// Empty association documents are honest defaults until real signing IDs exist.
await writeFile('dist/.well-known/apple-app-site-association', JSON.stringify({ applinks: { apps: [], details: apple ? [{ appID: apple, paths: ['/join*'] }] : [] } }));
await writeFile('dist/.well-known/assetlinks.json', JSON.stringify(android ? [{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: 'fr.onyva.app', sha256_cert_fingerprints: [android] } }] : []));
