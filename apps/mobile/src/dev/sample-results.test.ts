import { describe, expect, it } from 'vitest';
import { outingSchema, recommendationResponseSchema } from '@onyva/shared';
import { sampleOuting, sampleRecommendations, sampleTimeline } from './sample-results';

// The preview data must respect the real contract, with the future engine as source.
describe('synthetic preview data of the results screen', () => {
  it('follows the shared schemas, with source gtfs', () => {
    expect(outingSchema.safeParse(sampleOuting).success).toBe(true);
    for (const step of sampleTimeline()) {
      const parsed = recommendationResponseSchema.safeParse(step.response);
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      expect(step.response.source).toBe('gtfs');
    }
  });
  it('goes through comparison, return checks, then the result, in order', () => {
    const stages = sampleTimeline().map(step => step.response.progress?.stage);
    expect([...new Set(stages)]).toEqual(['isochrones', 'returns', 'complete']);
  });
  it('keeps fairness numbers consistent with the journeys', () => {
    for (const r of sampleRecommendations) {
      const durations = r.journeys.map(j => j.outbound.duration);
      expect(r.maximum).toBe(Math.max(...durations));
      expect(r.spread).toBe(Math.max(...durations) - Math.min(...durations));
    }
    expect(sampleRecommendations[0]!.maximum).toBeLessThan(sampleRecommendations[2]!.maximum);
  });
  it('says it is invented', () => {
    expect(sampleTimeline().every(step => step.response.warnings.some(w => w.includes('inventées')))).toBe(true);
  });
});
