import { z } from 'zod';
import { journeySchema, legSchema } from './index.ts';

// Contract of the private transit engine service, called only by the `recommend` Edge Function.
// Times are Unix seconds (UTC). Stations use the catalogue format `stop_area:IDFM:<n>`.
// No address, position, outing or user identifier ever crosses this boundary.

export const ENGINE_LIMITS = {
  /** oneToAll window: 2 h by default (validated on 6 November 2026), capped by the longest journey, 4 h. */
  defaultWindowSeconds: 2 * 3600,
  maxWindowSeconds: 4 * 3600,
  maxTargets: 20_000,
  maxJourneyItems: 64,
  /** rank: one origin per participant, the outing limit. */
  maxRankOrigins: 10,
  maxRankCandidates: 50,
  defaultRankCandidates: 20,
  /** 20 000 targets of about 25 bytes each must fit: rank sends every station with an open venue. */
  maxBodyBytes: 512 * 1024,
  requestTimeoutMs: 5_000,
} as const;

export const engineStationIdSchema = z.string().min(1).max(64).regex(/^stop_area:IDFM:[A-Za-z0-9_-]+$/);
const epochSchema = z.number().int().min(1_700_000_000).max(4_102_444_800);

export const oneToAllRequestSchema = z.object({
  origin: engineStationIdSchema,
  arriveBy: epochSchema,
  window: z.number().int().min(60).max(ENGINE_LIMITS.maxWindowSeconds).optional(),
  targets: z.array(engineStationIdSchema).min(1).max(ENGINE_LIMITS.maxTargets).optional(),
}).strict();
export type OneToAllRequest = z.infer<typeof oneToAllRequestSchema>;

export const oneToAllResponseSchema = z.object({
  snapshot: z.string(),
  origin: engineStationIdSchema,
  arriveBy: epochSchema,
  durations: z.array(z.object({ stationId: engineStationIdSchema, latestDeparture: epochSchema, duration: z.number().int().nonnegative(), transfers: z.number().int().nonnegative() })),
  unreachable: z.number().int().nonnegative(),
});
export type OneToAllResponse = z.infer<typeof oneToAllResponseSchema>;

/**
 * Fairness ranking of candidate stations for a group, done inside the engine so that only the best stations
 * cross the network. `origins`: one entry per participant, keyed by an opaque value chosen by the caller.
 * `targets`: stations worth ranking, typically those with an open venue nearby. Unknown targets are skipped and counted.
 */
export const rankRequestSchema = z.object({
  origins: z.array(z.object({ key: z.string().min(1).max(64), station: engineStationIdSchema }).strict())
    .min(2).max(ENGINE_LIMITS.maxRankOrigins)
    .refine(origins => new Set(origins.map(origin => origin.key)).size === origins.length, 'Each key must be unique.'),
  arriveBy: epochSchema,
  window: z.number().int().min(60).max(ENGINE_LIMITS.maxWindowSeconds).optional(),
  targets: z.array(engineStationIdSchema).min(1).max(ENGINE_LIMITS.maxTargets),
  limit: z.number().int().min(1).max(ENGINE_LIMITS.maxRankCandidates).optional(),
}).strict();
export type RankRequest = z.infer<typeof rankRequestSchema>;
export const rankCandidateSchema = z.object({
  stationId: engineStationIdSchema,
  maximum: z.number().int().nonnegative(),
  sum: z.number().int().nonnegative(),
  spread: z.number().int().nonnegative(),
  durations: z.array(z.object({ key: z.string(), duration: z.number().int().nonnegative() })),
});
export const rankResponseSchema = z.object({
  snapshot: z.string(),
  arriveBy: epochSchema,
  candidates: z.array(rankCandidateSchema).max(ENGINE_LIMITS.maxRankCandidates),
  /** Targets reached by every origin, before the limit. */
  reachable: z.number().int().nonnegative(),
  unknownTargets: z.number().int().nonnegative(),
});
export type RankResponse = z.infer<typeof rankResponseSchema>;

export const engineDirectionSchema = z.enum(['arriveBy', 'departAfter']);
export const journeyItemSchema = z.object({
  key: z.string().min(1).max(120),
  from: engineStationIdSchema,
  to: engineStationIdSchema,
  time: epochSchema,
  direction: engineDirectionSchema,
}).strict();
export const journeysRequestSchema = z.object({
  items: z.array(journeyItemSchema).min(1).max(ENGINE_LIMITS.maxJourneyItems)
    .refine(items => new Set(items.map(item => item.key)).size === items.length, 'Each key must be unique.'),
}).strict();
export type JourneysRequest = z.infer<typeof journeysRequestSchema>;

/** Same shape as `Leg`, plus the GTFS route and the stations passed, used by Supabase to apply disruptions. */
export const engineLegSchema = legSchema.extend({ routeId: z.string().optional(), stations: z.array(engineStationIdSchema).optional() });
export const engineJourneySchema = journeySchema.extend({ legs: z.array(engineLegSchema), transfers: z.number().int().nonnegative() });
export type EngineJourneyContract = z.infer<typeof engineJourneySchema>;
export const journeyOutcomeSchema = z.discriminatedUnion('status', [
  z.object({ key: z.string(), status: z.literal('ok'), journey: engineJourneySchema }),
  z.object({ key: z.string(), status: z.literal('none'), reason: z.enum(['no-service', 'on-demand-only']) }),
]);
export const journeysResponseSchema = z.object({ snapshot: z.string(), results: z.array(journeyOutcomeSchema) });
export type JourneysResponse = z.infer<typeof journeysResponseSchema>;

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const engineMetaSchema = z.object({
  snapshot: z.string(),
  feedSha256: z.string().regex(/^[0-9a-f]{64}$|^synthetic/),
  validFrom: isoDateSchema,
  validUntil: isoDateSchema,
  builtAt: z.string().datetime(),
  stations: z.number().int().nonnegative(),
  trips: z.number().int().nonnegative(),
});
export type EngineMeta = z.infer<typeof engineMetaSchema>;

export const engineErrorSchema = z.object({
  error: z.enum(['invalid-request', 'unknown-station', 'unauthorized', 'too-large', 'out-of-validity', 'unavailable', 'timeout', 'not-found', 'internal']),
  message: z.string(),
  validFrom: isoDateSchema.optional(),
  validUntil: isoDateSchema.optional(),
});
export type EngineError = z.infer<typeof engineErrorSchema>;
