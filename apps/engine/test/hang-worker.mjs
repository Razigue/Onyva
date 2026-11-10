// Test fixture: a worker that loads, then never answers. Used to check deadlines.
import { parentPort } from 'node:worker_threads';
parentPort.postMessage({ type: 'ready' });
parentPort.on('message', () => undefined);
