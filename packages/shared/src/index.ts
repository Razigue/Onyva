import { z } from 'zod';
import { shortInviteCodeSchema } from './invitation.ts';

export const idSchema = z.string().min(1).max(120);
export const activitySchema = z.enum(['drinks', 'dinner', 'coffee', 'other']);
export const activityLabels = { drinks: 'Un verre', dinner: 'Un resto', coffee: 'Un café', other: 'Autre chose' } as const;
export const stationSchema = z.object({ id: idSchema, name: z.string().min(1), longitude: z.number().min(1.4).max(3.6), latitude: z.number().min(48.1).max(49.3), lines: z.array(z.string()) });
export type Station = z.infer<typeof stationSchema>;
export const participantSchema = z.object({ id: idSchema, userId: z.string().uuid().nullable(), name: z.string().trim().min(1).max(40), departureId: idSchema, returnId: idSchema });
export type Participant = z.infer<typeof participantSchema>;
export const outingSchema = z.object({
  id: z.string().uuid(), ownerId: idSchema, inviteCode: z.string().min(16).max(100), shortCode: shortInviteCodeSchema.optional(),
  startsAt: z.string().datetime(), endsAt: z.string().datetime(), activity: activitySchema,
  participants: z.array(participantSchema).min(1).max(10), confirmedVenueId: idSchema.nullable(),
  updatedAt: z.string().datetime(), mode: z.enum(['demo', 'live']),
  selectedVenue: z.lazy(() => venueSchema).nullable().optional(),
}).refine(o => Date.parse(o.endsAt) > Date.parse(o.startsAt), { message: 'La fin doit être après le début.' });
export type Outing = z.infer<typeof outingSchema>;
export const createOutingSchema = z.object({ startsAt: z.string().datetime(), endsAt: z.string().datetime(), activity: activitySchema, departureId: idSchema, name: z.string().trim().min(1).max(40) })
  .refine(o => Date.parse(o.endsAt) > Date.parse(o.startsAt), { message: 'La fin doit être après le début.' });
export const joinSchema = z.object({ inviteCode: z.string().min(16).max(100), name: z.string().trim().min(1).max(40), departureId: idSchema, returnId: idSchema });
export const cuisineSchema = z.enum(['meat', 'seafood', 'italian', 'chinese', 'japanese', 'indian', 'french', 'middleEastern', 'vegetarian', 'other']);
export type Cuisine = z.infer<typeof cuisineSchema>;
export const cuisineLabels: Record<Cuisine, string> = { meat: 'Viande et grillades', seafood: 'Poisson et fruits de mer', italian: 'Italien', chinese: 'Chinois', japanese: 'Japonais', indian: 'Indien', french: 'Français', middleEastern: 'Oriental', vegetarian: 'Options végétariennes', other: 'Autres cuisines' };
export const recommendationLimits = { dinner: 12, drinks: 6, coffee: 6, other: 6 } as const;
export function venueReviewsUrl(venue: Pick<Venue, 'name' | 'latitude' | 'longitude'>): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.name} ${venue.latitude},${venue.longitude}`)}`;
}
export const venueSchema = z.object({
  id: idSchema, name: z.string().min(1), stationId: idSchema, neighborhood: z.string(),
  kind: activitySchema, cuisines: z.array(cuisineSchema).max(10).optional(), walkSeconds: z.number().int().min(0).max(300),
  longitude: z.number(), latitude: z.number(),
  // Explicit intervals are prepared by the data adapter, never guessed by the engine.
  openIntervals: z.array(z.object({ start: z.number(), end: z.number() })),
  source: z.enum(['demo', 'osm']),
});
export type Venue = z.infer<typeof venueSchema>;
export const osmVenueResponseSchema = z.object({ elements: z.array(z.object({ type: z.enum(['node', 'way', 'relation']), id: z.number(), lat: z.number().optional(), lon: z.number().optional(), center: z.object({ lat: z.number(), lon: z.number() }).optional(), tags: z.record(z.string()).optional() })) });
const osmLicenseFields = { attribution: z.literal('© OpenStreetMap contributors').default('© OpenStreetMap contributors'), license: z.literal('ODbL-1.0').default('ODbL-1.0'), licenseUrl: z.literal('https://opendatacommons.org/licenses/odbl/1-0/').default('https://opendatacommons.org/licenses/odbl/1-0/') };
export const previewSourceSchema = z.object({ ...osmLicenseFields, fetchedAt: z.string().datetime(), stations: z.array(stationSchema), venues: z.array(z.object({ venue: venueSchema.omit({ openIntervals: true }).extend({ source: z.literal('osm') }), openingHours: z.string().min(1) })) });
export const previewCatalogSchema = z.object({ ...osmLicenseFields, fetchedAt: z.string().datetime(), generatedAt: z.string().datetime(), validFrom: z.number(), validUntil: z.number(), stations: z.array(stationSchema), venues: z.array(venueSchema.extend({ source: z.literal('osm') })) });
export const legSchema = z.object({ from: idSchema, to: idSchema, departure: z.number(), arrival: z.number(), mode: z.enum(['walk', 'transit', 'wait']), line: z.string().optional(), fromName: z.string().optional(), toName: z.string().optional(), night: z.boolean().optional() });
export type Leg = z.infer<typeof legSchema>;
export const journeySchema = z.object({ departure: z.number(), arrival: z.number(), duration: z.number().nonnegative(), legs: z.array(legSchema), night: z.boolean() });
export type Journey = z.infer<typeof journeySchema>;
export const recommendationSchema = z.object({ venue: venueSchema, journeys: z.array(z.object({ participantId: idSchema, outbound: journeySchema, inbound: journeySchema })), maximum: z.number(), sum: z.number(), spread: z.number() });
export type Recommendation = z.infer<typeof recommendationSchema>;
export const recommendationRequestSchema = z.object({ startsAt: z.string().datetime(), endsAt: z.string().datetime(), activity: activitySchema, participants: z.array(participantSchema).min(2).max(10) }).refine(r => Date.parse(r.endsAt) > Date.parse(r.startsAt));
export const calculationProgressSchema = z.object({ stage: z.enum(['isochrones', 'returns', 'complete', 'failed']), completed: z.number().int().nonnegative(), total: z.number().int().nonnegative() });
export const stationCandidateSchema = z.object({ stationId: idSchema, maximum: z.number().nonnegative(), sum: z.number().nonnegative(), spread: z.number().nonnegative(), times: z.array(z.object({ participantId: idSchema, duration: z.number().nonnegative() })) });
export const recommendationResponseSchema = z.object({ progress: calculationProgressSchema.optional(), stationCandidates: z.array(stationCandidateSchema).max(20).optional(), recommendations: z.array(recommendationSchema).max(12), computedAt: z.string().datetime(), source: z.enum(['demo', 'prim', 'gtfs']), warnings: z.array(z.string()) });
export type RecommendationResponse = z.infer<typeof recommendationResponseSchema>;
export const venueReactionSchema = z.object({ venueId: idSchema, userId: z.string().uuid() });
export const venueReactionsSchema = z.array(venueReactionSchema).max(120);
export type VenueReaction = z.infer<typeof venueReactionSchema>;
export const expoPushTokenSchema = z.string().max(200).regex(/^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/);
export const pushJobSchema = z.object({ id: z.string().uuid(), token: expoPushTokenSchema, outingId: z.string().uuid(), venueName: z.string(), startsAt: z.string().datetime(), attempts: z.number().int().min(1).max(3) });
export const expoPushResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), id: z.string().optional() }),
  z.object({ status: z.literal('error'), details: z.object({ error: z.string() }).optional() }),
]);
export const notificationDataSchema = z.object({ kind: z.literal('venue-confirmed'), outingId: z.string().uuid() });
export const previewCacheSchema = z.object({ outing: outingSchema, results: recommendationResponseSchema.nullable() }).refine(cache => cache.outing.mode === 'demo' && (cache.results === null || cache.results.recommendations.every(result => result.venue.source === 'osm')));
export const invitationPreviewSchema = z.object({ shortCode: shortInviteCodeSchema.optional(), name: z.string(), startsAt: z.string().datetime(), activity: activitySchema, count: z.number().int().min(1).max(10) });

export function defaultStart(now = new Date()): Date {
  return new Date(Math.ceil((now.getTime() + 60 * 60_000) / (30 * 60_000)) * 30 * 60_000);
}
export function isExpired(outing: Pick<Outing, 'endsAt'>, now = Date.now()): boolean {
  return now >= Date.parse(outing.endsAt) + 24 * 60 * 60_000;
}
export function formatTime(value: string | number): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).format(new Date(typeof value === 'number' ? value * 1000 : value));
}

export * from './prim.ts';
export * from './invitation.ts';
export * from './location.ts';

export const authProvidersSchema = z.object({ external: z.object({ apple: z.boolean().default(false), google: z.boolean().default(false) }) });
