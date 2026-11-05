import { expect, it } from 'vitest';
import { defaultStart, isExpired, stationSchema, recommendationRequestSchema } from './index';

it('prefills the next round slot at least one hour away across midnight', () => {
  expect(defaultStart(new Date('2026-10-27T22:40:00Z')).toISOString()).toBe('2026-10-28T00:00:00.000Z');
});
it('expires exactly twenty-four hours after the end', () => {
  const outing = { endsAt: '2026-10-27T22:30:00Z' };
  expect(isExpired(outing, Date.parse('2026-10-28T22:29:59Z'))).toBe(false);
  expect(isExpired(outing, Date.parse('2026-10-28T22:30:00Z'))).toBe(true);
});
it('rejects locations outside Île-de-France and incomplete recommendation requests', () => {
  expect(stationSchema.safeParse({ id: 'lyon', name: 'Lyon', latitude: 45.76, longitude: 4.83, lines: [] }).success).toBe(false);
  expect(recommendationRequestSchema.safeParse({ participants: [] }).success).toBe(false);
});
