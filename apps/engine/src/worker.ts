// One engine per thread. The snapshot bytes live in a SharedArrayBuffer: every thread reads the same memory.
import { parentPort, workerData } from 'node:worker_threads';
import { deserializeNetwork, OutOfValidityError, TransitEngine, UnknownStationError } from '@onyva/transit-engine';
import type { EngineTask, EngineTaskResult, TaskFailure, WorkerInit, WorkerReply, WorkerRequest } from './protocol.ts';

const port = parentPort;
if (!port) throw new Error('The engine worker must run in a worker thread.');
const engine = new TransitEngine(deserializeNetwork((workerData as WorkerInit).bytes));

function run(task: EngineTask): EngineTaskResult {
  if (task.kind === 'oneToAll') return { kind: 'oneToAll', result: engine.oneToAll(task) };
  return { kind: 'journeys', results: task.items.map(item => ({ key: item.key, ...engine.journey(item) })) };
}

function failure(error: unknown): TaskFailure {
  if (error instanceof OutOfValidityError) return { kind: 'out-of-validity', message: error.message, validFrom: error.validFrom, validUntil: error.validUntil };
  if (error instanceof UnknownStationError) return { kind: 'unknown-station', message: error.message, stationId: error.stationId };
  return { kind: 'internal', message: error instanceof Error ? error.message : 'Unknown error.' };
}

port.on('message', ({ id, task }: WorkerRequest) => {
  let reply: WorkerReply;
  try { reply = { type: 'done', id, result: run(task) }; } catch (error) { reply = { type: 'failed', id, failure: failure(error) }; }
  port.postMessage(reply);
});
port.postMessage({ type: 'ready' } satisfies WorkerReply);
