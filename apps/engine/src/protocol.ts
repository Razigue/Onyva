// Messages between the HTTP thread and the engine workers.
import type { Direction, JourneyResult, OneToAllResult } from '@onyva/transit-engine';

export interface JourneyTaskItem { key: string; from: string; to: string; time: number; direction: Direction }
export type EngineTask =
  | { kind: 'oneToAll'; origin: string; arriveBy: number; window?: number; targets?: string[] }
  | { kind: 'journeys'; items: JourneyTaskItem[] };
export type EngineTaskResult =
  | { kind: 'oneToAll'; result: OneToAllResult }
  | { kind: 'journeys'; results: Array<{ key: string } & JourneyResult> };

export type TaskFailure =
  | { kind: 'out-of-validity'; message: string; validFrom: string; validUntil: string }
  | { kind: 'unknown-station'; message: string; stationId: string }
  | { kind: 'internal'; message: string };

export type WorkerReply =
  | { type: 'ready' }
  | { type: 'done'; id: number; result: EngineTaskResult }
  | { type: 'failed'; id: number; failure: TaskFailure };
export interface WorkerRequest { id: number; task: EngineTask }
export interface WorkerInit { bytes: Uint8Array }
