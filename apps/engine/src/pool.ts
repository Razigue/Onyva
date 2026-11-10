// Fixed pool of engine threads. One task at a time per thread, a shared FIFO queue, and a deadline per task.
// A task past its deadline is dropped from the queue, or its thread is terminated and replaced:
// a RAPTOR search cannot be interrupted from outside.
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import type { EngineTask, EngineTaskResult, TaskFailure, WorkerInit, WorkerReply } from './protocol.ts';

export class TaskError extends Error {
  constructor(readonly failure: TaskFailure) { super(failure.message); }
}
export class TaskTimeoutError extends Error {
  constructor() { super('Engine deadline exceeded.'); }
}

interface Pending { id: number; task: EngineTask; resolve: (result: EngineTaskResult) => void; reject: (error: Error) => void; timer: NodeJS.Timeout; slot?: Slot }
interface Slot { worker: Worker; ready: boolean; current?: Pending }

export interface PoolOptions { size: number; workerUrl?: URL }

/** Workers written in TypeScript need the tsx loader during development and tests; the Docker image runs the bundle. */
export function defaultWorkerUrl(): URL {
  const extension = import.meta.url.endsWith('.ts') ? '.ts' : '.mjs';
  return new URL(`./worker${extension}`, import.meta.url);
}

export class EnginePool {
  private readonly slots: Slot[] = [];
  private readonly queue: Pending[] = [];
  private readonly path: string;
  private nextId = 1;
  private closing = false;
  private readonly readyWaiters: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];

  constructor(private readonly bytes: Uint8Array, options: PoolOptions) {
    if (!(bytes.buffer instanceof SharedArrayBuffer)) throw new Error('The snapshot must be backed by a SharedArrayBuffer.');
    this.path = fileURLToPath((options.workerUrl ?? defaultWorkerUrl()).href);
    for (let i = 0; i < Math.max(1, options.size); i++) this.slots.push(this.spawn());
  }

  get size() { return this.slots.length; }
  get queued() { return this.queue.length; }

  /** Resolves when every thread has loaded the snapshot. */
  ready(): Promise<void> {
    if (this.slots.every(slot => slot.ready)) return Promise.resolve();
    return new Promise((resolve, reject) => this.readyWaiters.push({ resolve, reject }));
  }

  run(task: EngineTask, timeoutMs: number): Promise<EngineTaskResult> {
    if (this.closing) return Promise.reject(new Error('The engine pool is closing.'));
    return new Promise((resolve, reject) => {
      const pending: Pending = { id: this.nextId++, task, resolve, reject, timer: setTimeout(() => this.expire(pending), Math.max(0, timeoutMs)) };
      this.queue.push(pending);
      this.dispatch();
    });
  }

  /** Waits for running and queued tasks, then stops every thread. */
  async close(): Promise<void> {
    this.closing = true;
    while (this.queue.length > 0 || this.slots.some(slot => slot.current)) await new Promise(resolve => setTimeout(resolve, 20));
    await Promise.all(this.slots.map(slot => slot.worker.terminate()));
  }

  private spawn(): Slot {
    const execArgv = this.path.endsWith('.ts') ? ['--import', 'tsx'] : [];
    const worker = new Worker(this.path, { workerData: { bytes: this.bytes } satisfies WorkerInit, execArgv });
    const slot: Slot = { worker, ready: false };
    worker.on('message', (reply: WorkerReply) => this.onReply(slot, reply));
    worker.on('error', error => this.onCrash(slot, error));
    worker.on('exit', code => { if (code !== 0) this.onCrash(slot, new Error(`Engine thread stopped with code ${code}.`)); });
    return slot;
  }

  private onReply(slot: Slot, reply: WorkerReply) {
    if (reply.type === 'ready') {
      slot.ready = true;
      if (this.slots.every(s => s.ready)) for (const waiter of this.readyWaiters.splice(0)) waiter.resolve();
      this.dispatch();
      return;
    }
    const pending = slot.current;
    if (!pending || pending.id !== reply.id) return;
    slot.current = undefined;
    clearTimeout(pending.timer);
    if (reply.type === 'done') pending.resolve(reply.result); else pending.reject(new TaskError(reply.failure));
    this.dispatch();
  }

  private onCrash(slot: Slot, error: Error) {
    const index = this.slots.indexOf(slot);
    if (index < 0) return;
    const pending = slot.current;
    slot.current = undefined;
    if (pending) { clearTimeout(pending.timer); pending.reject(new TaskError({ kind: 'internal', message: error.message })); }
    if (!slot.ready) {
      // A thread that cannot load the snapshot will never recover: fail fast instead of respawning in a loop.
      for (const waiter of this.readyWaiters.splice(0)) waiter.reject(error);
      this.slots.splice(index, 1);
      void slot.worker.terminate();
      return;
    }
    this.replace(slot);
  }

  private replace(slot: Slot) {
    const index = this.slots.indexOf(slot);
    if (index < 0) return;
    this.slots.splice(index, 1);
    slot.worker.removeAllListeners();
    void slot.worker.terminate();
    if (!this.closing) this.slots.push(this.spawn());
    this.dispatch();
  }

  private expire(pending: Pending) {
    const queued = this.queue.indexOf(pending);
    if (queued >= 0) this.queue.splice(queued, 1);
    else if (pending.slot && pending.slot.current === pending) { pending.slot.current = undefined; this.replace(pending.slot); }
    pending.reject(new TaskTimeoutError());
  }

  private dispatch() {
    for (const slot of this.slots) {
      if (this.queue.length === 0) return;
      if (!slot.ready || slot.current) continue;
      const pending = this.queue.shift()!;
      pending.slot = slot; slot.current = pending;
      slot.worker.postMessage({ id: pending.id, task: pending.task });
    }
  }
}
