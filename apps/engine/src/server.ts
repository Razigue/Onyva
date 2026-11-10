// HTTP layer of the engine service. Private API: every route except /health requires the shared secret.
// Logs carry only the route, the status, the duration and the snapshot: never a request body.
import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { gzipSync } from 'node:zlib';
import { ENGINE_LIMITS, journeysRequestSchema, oneToAllRequestSchema } from '@onyva/shared/engine';
import type { EngineError, EngineMeta, JourneysResponse, OneToAllResponse } from '@onyva/shared/engine';
import type { EnginePool } from './pool.ts';
import { TaskError, TaskTimeoutError } from './pool.ts';
import type { EngineTaskResult } from './protocol.ts';

export interface EngineState { snapshot: string; meta: EngineMeta; pool: EnginePool }
export interface ServerOptions {
  secret: string;
  /** Current snapshot and pool, null while none is loaded. Read on every request so that a reload swaps them atomically. */
  state: () => EngineState | null;
  requestTimeoutMs?: number;
  log?: (entry: { route: string; status: number; ms: number; snapshot: string | null }) => void;
}

class HttpError extends Error {
  constructor(readonly status: number, readonly body: EngineError) { super(body.message); }
}
const fail = (status: number, error: EngineError['error'], message: string, extra: Partial<EngineError> = {}) => new HttpError(status, { error, message, ...extra });

const digest = (value: string) => createHash('sha256').update(value).digest();
function authorized(header: string | undefined, expected: Buffer): boolean {
  const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
  // Both sides are hashed to a fixed length, so the comparison time does not depend on the token.
  return timingSafeEqual(digest(token), expected) && token.length > 0;
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const declared = Number(request.headers['content-length'] ?? 0);
  if (declared > ENGINE_LIMITS.maxBodyBytes) throw fail(413, 'too-large', `Body above ${ENGINE_LIMITS.maxBodyBytes} bytes.`);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > ENGINE_LIMITS.maxBodyBytes) throw fail(413, 'too-large', `Body above ${ENGINE_LIMITS.maxBodyBytes} bytes.`);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw fail(400, 'invalid-request', 'Body is not valid JSON.'); }
}

function send(request: IncomingMessage, response: ServerResponse, status: number, body: unknown) {
  let payload: Buffer = Buffer.from(JSON.stringify(body));
  const headers: Record<string, string> = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  if (payload.length > 1024 && /\bgzip\b/.test(String(request.headers['accept-encoding'] ?? ''))) { payload = gzipSync(payload, { level: 4 }); headers['content-encoding'] = 'gzip'; }
  headers['content-length'] = String(payload.length);
  response.writeHead(status, headers).end(payload);
}

function taskError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  if (error instanceof TaskTimeoutError) return fail(504, 'timeout', 'Engine deadline exceeded.');
  if (error instanceof TaskError) {
    const failure = error.failure;
    if (failure.kind === 'out-of-validity') return fail(422, 'out-of-validity', 'Date outside the feed validity period.', { validFrom: failure.validFrom, validUntil: failure.validUntil });
    if (failure.kind === 'unknown-station') return fail(400, 'unknown-station', failure.message);
  }
  return fail(500, 'internal', 'Engine error.');
}

function expect<K extends EngineTaskResult['kind']>(result: EngineTaskResult, kind: K): Extract<EngineTaskResult, { kind: K }> {
  if (result.kind !== kind) throw fail(500, 'internal', 'Unexpected engine answer.');
  return result as Extract<EngineTaskResult, { kind: K }>;
}

const ROUTES = ['GET /v1/meta', 'POST /v1/one-to-all', 'POST /v1/journeys'];

export function createEngineServer(options: ServerOptions): Server {
  if (options.secret.length < 32) throw new Error('ENGINE_SECRET must hold at least 32 characters.');
  const expected = digest(options.secret), timeoutMs = options.requestTimeoutMs ?? ENGINE_LIMITS.requestTimeoutMs;
  const log = options.log ?? (entry => console.info(JSON.stringify(entry)));

  const loaded = () => { const state = options.state(); if (!state) throw fail(503, 'unavailable', 'No snapshot loaded.'); return state; };

  async function oneToAll(body: unknown, deadline: number): Promise<OneToAllResponse> {
    const parsed = oneToAllRequestSchema.safeParse(body);
    if (!parsed.success) throw fail(400, 'invalid-request', parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '));
    const state = loaded();
    const { result } = expect(await state.pool.run({ kind: 'oneToAll', ...parsed.data }, deadline - Date.now()), 'oneToAll');
    return { snapshot: state.snapshot, origin: result.origin, arriveBy: result.arriveBy, durations: result.durations, unreachable: result.unreachable };
  }

  async function journeys(body: unknown, deadline: number): Promise<JourneysResponse> {
    const items = (body as { items?: unknown } | null)?.items;
    if (Array.isArray(items) && items.length > ENGINE_LIMITS.maxJourneyItems) throw fail(413, 'too-large', `At most ${ENGINE_LIMITS.maxJourneyItems} items per batch.`);
    const parsed = journeysRequestSchema.safeParse(body);
    if (!parsed.success) throw fail(400, 'invalid-request', parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '));
    const state = loaded(), list = parsed.data.items;
    // Spread the batch over every thread, keeping the request order in the answer.
    const chunks = Math.min(state.pool.size, list.length), size = Math.ceil(list.length / chunks);
    const parts = await Promise.all(Array.from({ length: chunks }, (_, i) => state.pool.run({ kind: 'journeys', items: list.slice(i * size, (i + 1) * size) }, deadline - Date.now())));
    return { snapshot: state.snapshot, results: parts.flatMap(part => expect(part, 'journeys').results) };
  }

  return createServer((request, response) => {
    const started = performance.now(), deadline = Date.now() + timeoutMs;
    const url = new URL(request.url ?? '/', 'http://engine'), route = `${request.method} ${url.pathname}`;
    let status = 500;
    const reply = (code: number, body: unknown) => { status = code; send(request, response, code, body); };
    void (async () => {
      try {
        if (route === 'GET /health') {
          const state = options.state();
          reply(state ? 200 : 503, state ? { status: 'ok', snapshot: state.snapshot } : { status: 'loading' });
          return;
        }
        if (!ROUTES.includes(route)) throw fail(404, 'not-found', 'Unknown route.');
        if (!authorized(request.headers.authorization, expected)) throw fail(401, 'unauthorized', 'Missing or invalid token.');
        if (route === 'GET /v1/meta') { reply(200, loaded().meta); return; }
        const body = await readJson(request);
        reply(200, route === 'POST /v1/one-to-all' ? await oneToAll(body, deadline) : await journeys(body, deadline));
      } catch (error) {
        const http = taskError(error);
        if (http.status === 500) console.error(JSON.stringify({ route, error: error instanceof Error ? error.message : 'unknown' }));
        // Do not leave an oversized upload hanging: answer, then close the connection.
        if (http.status === 413) response.setHeader('connection', 'close');
        reply(http.status, http.body);
      } finally {
        log({ route: route === 'GET /health' || ROUTES.includes(route) ? route : 'other', status, ms: Math.round(performance.now() - started), snapshot: options.state()?.snapshot ?? null });
      }
    })();
  });
}
