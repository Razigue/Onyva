import { z } from 'zod';

export const primPlaceSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  embedded_type: z.string().optional(),
  stop_area: z.object({
    id: z.string(),
    name: z.string().optional(),
    label: z.string().optional(),
    coord: z.object({ lon: z.string(), lat: z.string() }),
  }).optional(),
  stop_point: z.object({ id: z.string(), stop_area: z.object({ id: z.string() }).optional() })
    .optional(),
});
export const primSectionSchema = z.object({
  type: z.string(),
  mode: z.string().optional(),
  data_freshness: z.enum(['base_schedule', 'realtime']).optional(),
  departure_date_time: z.string(),
  arrival_date_time: z.string(),
  from: primPlaceSchema.optional(),
  to: primPlaceSchema.optional(),
  display_informations: z.object({
    code: z.string().optional(),
    name: z.string().optional(),
    network: z.string().optional(),
  }).optional(),
});
export const primJourneySchema = z.object({
  duration: z.number().nonnegative(),
  departure_date_time: z.string(),
  arrival_date_time: z.string(),
  from: primPlaceSchema.optional(),
  to: primPlaceSchema.optional(),
  sections: z.array(primSectionSchema).optional(),
  status: z.string().optional(),
});
export const primJourneysSchema = z.object({
  journeys: z.array(primJourneySchema).default([]),
  error: z.object({ id: z.string(), message: z.string().optional() }).optional(),
  pagination: z.object({ total_result: z.number(), items_on_page: z.number() }).optional(),
  disruptions: z.array(
    z.object({
      id: z.string().optional(),
      messages: z.array(z.object({ text: z.string() })).optional(),
    }),
  ).optional(),
});
export type PrimJourneys = z.infer<typeof primJourneysSchema>;
export const primRequestSchema = z.object({
  kind: z.enum(['isochrone', 'journey']),
  from: z.string().min(1).max(200),
  to: z.string().max(200).optional(),
  at: z.string().datetime(),
  direction: z.enum(['departure', 'arrival']),
  freshness: z.enum(['base_schedule', 'realtime']),
});
export type PrimRequest = z.infer<typeof primRequestSchema>;
export const primCoverageSchema = z.object({
  ready: z.boolean(),
  provider: z.enum(['prim', 'engine']),
  quotaVerified: z.boolean(),
  manualReady: z.boolean().default(false),
  /** Engine only: first and last service day of the timetable, Paris dates. No outing outside them. */
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type PrimCoverage = z.infer<typeof primCoverageSchema>;
/** Message when the outing ends after the last published service day, null otherwise. Never computed for "now" instead. */
export function timetableLimit(coverage: Pick<PrimCoverage, 'validUntil'> | null, endsAt: Date): string | null {
  if (!coverage?.validUntil) return null;
  const endDay = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(endsAt);
  if (endDay <= coverage.validUntil) return null;
  const label = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'long' }).format(new Date(`${coverage.validUntil}T00:00:00Z`));
  return `Les horaires sont publiés jusqu’au ${label}. Choisis une date plus proche.`;
}
export const recommendationInvocationSchema = z.union([
  z.object({ outingId: z.string().uuid() }),
  z.object({ action: z.literal('coverage') }),
]);

export function primDateTime(value: string): number | null {
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(value)) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed / 1000 : null;
  }
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(value);
  if (!match) return null;
  const wall = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`;
  const utc = Date.parse(`${wall}Z`);
  const expected = wall.replace('T', ' ');
  const candidates = [1, 2].map((offset) => utc - offset * 3600_000).filter((time) =>
    new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).format(time) === expected
  );
  // Ambiguous or nonexistent Paris times must not promise a return.
  return candidates.length === 1 ? candidates[0]! / 1000 : null;
}
