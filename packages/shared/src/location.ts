import { z } from 'zod';
export const locationPayloadSchema = z.object({
  participantId: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timestamp: z.number().int(),
  accuracy: z.number().nonnegative().nullable(),
});
export type LivePosition = z.infer<typeof locationPayloadSchema>;
export const locationInvocationSchema = z.union([
  z.object({ action: z.literal('start'), outingId: z.string().uuid() }),
  z.object({
    action: z.literal('position'),
    outingId: z.string().uuid(),
    lease: z.string().max(2000),
    position: locationPayloadSchema.omit({ participantId: true }),
  }),
  z.object({ action: z.literal('stop'), outingId: z.string().uuid(), lease: z.string().max(2000) }),
]);
export const locationLeaseSchema = z.object({
  userId: z.string().uuid(),
  outingId: z.string().uuid(),
  expiresAt: z.number().int(),
  venueId: z.string(),
  startedAt: z.number().int(),
});
export const trackingSessionSchema = z.object({
  outingId: z.string().uuid(),
  lease: z.string(),
  expiresAt: z.number(),
  venue: z.object({ latitude: z.number(), longitude: z.number() }),
});
export function locationTopic(outing: { id: string; updatedAt: string }): string {
  return `outing:${outing.id}:${outing.updatedAt}`;
}
export function arrivedAt(
  position: { latitude: number; longitude: number },
  venue: { latitude: number; longitude: number },
): boolean {
  const radians = Math.PI / 180;
  const dx = (position.longitude - venue.longitude) * radians *
    Math.cos(position.latitude * radians);
  const dy = (position.latitude - venue.latitude) * radians;
  return Math.hypot(dx, dy) * 6371000 <= 75;
}
