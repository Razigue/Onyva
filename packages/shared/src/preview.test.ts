import { expect, it } from 'vitest';
import { previewCatalog, previewData, previewStations } from '../../../apps/mobile/src/lib/preview';
import { demoPlanner } from './demo';
import { rankVenues } from '../../fairness/src/index';
import { previewCacheSchema } from './index';

it('only exposes genuine OSM venue records and documented cuisines in the account-free catalog', () => {
  expect(previewCatalog.venues.length).toBeGreaterThan(100);
  const stations = new Set(previewStations.map(station => station.id));
  for (const venue of previewCatalog.venues) {
    expect(venue.source).toBe('osm');
    expect(venue.id).toMatch(/^osm-(node|way|relation)-\d+$/);
    expect(stations.has(venue.stationId)).toBe(true);
    expect(venue.walkSeconds).toBeLessThanOrEqual(300);
    expect(venue.openIntervals.length).toBeGreaterThan(0);
  }
});

it('uses actual venues with simulated journeys and excludes closed places for the meeting slot', () => {
  const startsAt = previewCatalog.validFrom + 19 * 3600, endsAt = startsAt + 9000;
  const start = performance.now();
  const { venues } = previewData(startsAt, endsAt, 'dinner');
  const participants = ['bastille', 'montreuil'].map(id => ({ id, userId: null, name: id, departureId: id, returnId: id }));
  const results = rankVenues({ participants, venues, startsAt, endsAt, kind: 'dinner', plan: demoPlanner });
  console.info(`Real-venue preview calculation: ${(performance.now() - start).toFixed(1)} ms; ${venues.length} actual venues.`);
  expect(results).toHaveLength(12);
  for (const result of results) {
    expect(result.venue.source).toBe('osm');
    expect(result.journeys.flatMap(journey => journey.outbound.legs).some(leg => leg.line === 'Démo')).toBe(true);
    expect(result.venue.openIntervals.some(interval => interval.start <= startsAt && interval.end >= endsAt)).toBe(true);
  }
});

it('never substitutes fictional venues for an uncovered date', () => {
  expect(() => previewData(previewCatalog.validUntil + 1, previewCatalog.validUntil + 9000, 'dinner')).toThrow('date');
  expect(() => previewData(previewCatalog.validFrom - 1, previewCatalog.validFrom + 9000, 'dinner')).toThrow('date');
});

it('rejects older fictional venue results in the account-free cache', () => {
  const now = new Date().toISOString();
  const outing = { id: '00000000-0000-4000-8000-000000000001', ownerId: 'demo-owner', inviteCode: '00000000-0000-4000-8000-000000000002', startsAt: now, endsAt: new Date(Date.now() + 9000_000).toISOString(), activity: 'dinner', participants: [{ id: 'p', userId: null, name: 'Toi', departureId: 'bastille', returnId: 'bastille' }], confirmedVenueId: null, updatedAt: now, mode: 'demo' };
  const result = { venue: { ...previewCatalog.venues[0], id: 'fictional', source: 'demo' }, journeys: [], maximum: 0, sum: 0, spread: 0 };
  const response = { recommendations: [result], computedAt: now, source: 'demo', warnings: [] };
  expect(previewCacheSchema.safeParse({ outing, results: response }).success).toBe(false);
  expect(previewCacheSchema.safeParse({ outing, results: { ...response, recommendations: [{ ...result, venue: previewCatalog.venues[0] }] } }).success).toBe(true);
});
