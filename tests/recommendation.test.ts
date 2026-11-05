import { expect, it, vi } from 'vitest';
import { calculateRecommendations, calculateSelectedVenue } from '../supabase/functions/_shared/recommendation';
import type { RecommendationServices } from '../supabase/functions/_shared/recommendation';
import type { Outing, RecommendationResponse, Station, Venue } from '@onyva/shared';
const meeting = '2026-11-02T18:30:00Z', end = '2026-11-02T21:00:00Z';
const outing: Outing = {
  id: '00000000-0000-4000-8000-000000000001',
  ownerId: 'owner',
  inviteCode: '00000000-0000-4000-8000-000000000002',
  mode: 'live',
  startsAt: meeting,
  endsAt: end,
  activity: 'dinner',
  updatedAt: meeting,
  confirmedVenueId: null,
  participants: ['a', 'b'].map((id) => ({
    id,
    name: id,
    userId: null,
    departureId: id,
    returnId: id,
  })),
};
const stations: Station[] = [{ id: 'a', name: 'A', longitude: 2.36, latitude: 48.86, lines: [] }, {
  id: 'b',
  name: 'B',
  longitude: 2.37,
  latitude: 48.87,
  lines: [],
}, { id: 'meeting', name: 'Rendez-vous', longitude: 2.38, latitude: 48.88, lines: [] }];
const venues: Venue[] = Array.from({ length: 4 }, (_, i) => ({
  id: `venue-${i}`,
  name: `Lieu ${i}`,
  stationId: 'meeting',
  neighborhood: 'Paris',
  longitude: 2.38 + i / 1000,
  latitude: 48.88,
  source: 'osm',
  kind: 'dinner',
  walkSeconds: 60 + i,
  cuisines: [],
  openIntervals: [{ start: 0, end: 9999999999 }],
}));
function services() {
  const progress: RecommendationResponse[] = [];
  const result: RecommendationServices = {
    stations: async () => stations,
    venues: async () => venues,
    save: async (value) => {
      progress.push(structuredClone(value));
      return true;
    },
    prim: {
      isochrone: vi.fn(async () => [{ stationId: 'meeting', duration: 600 }]),
      journey: vi.fn(async (from, to, at, direction) => {
        const time = Date.parse(at),
          departure = direction === 'arrival' ? time - 600000 : time + 120000,
          arrival = direction === 'arrival' ? time : time + 720000;
        const date = (value: number) => new Date(value).toISOString();
        return {
          journeys: [{
            duration: 600,
            departure_date_time: date(departure),
            arrival_date_time: date(arrival),
            sections: [{
              type: 'public_transport',
              departure_date_time: date(departure),
              arrival_date_time: date(arrival - 60000),
              from: { id: from },
              to: { id: 'station' },
              display_informations: { code: '5' },
            }, {
              type: 'street_network',
              mode: 'walking',
              departure_date_time: date(arrival - 60000),
              arrival_date_time: date(arrival),
              from: { id: 'station' },
              to: { id: to },
            }],
          }],
        };
      }),
    },
  };
  return { result, progress };
}
it('publishes participant and return progress, then only verified venues', async () => {
  const { result, progress } = services();
  const completed = await calculateRecommendations(outing, result, Date.parse(meeting) - 3600000);
  expect(completed.progress?.stage).toBe('complete');
  expect(completed.recommendations).toHaveLength(3);
  expect(progress.some((p) => p.progress?.stage === 'isochrones' && p.progress.completed === 1))
    .toBe(true);
  expect(progress.some((p) => p.progress?.stage === 'returns' && p.progress.completed === 1)).toBe(
    true,
  );
  expect(result.prim.isochrone).toHaveBeenCalledTimes(2);
  expect(result.prim.journey).toHaveBeenCalledTimes(12);
  expect(
    completed.recommendations.every((r) =>
      r.journeys.length === 2 && r.journeys.every((j) => j.inbound.duration === 720)
    ),
  ).toBe(true);
});
it('stops a superseded calculation before starting detailed verification', async () => {
  const { result } = services();
  result.save = async () => false;
  await expect(calculateRecommendations(outing, result)).rejects.toThrow('sortie');
  expect(result.prim.journey).not.toHaveBeenCalled();
});
it('does not publish a venue when any return has no solution', async () => {
  const { result } = services(), original = result.prim.journey;
  result.prim.journey = async (from, to, at, direction, freshness) =>
    direction === 'departure'
      ? { journeys: [], error: { id: 'no_solution' } }
      : original(from, to, at, direction, freshness);
  const completed = await calculateRecommendations(outing, result);
  expect(completed.recommendations).toEqual([]);
  expect(completed.progress?.stage).toBe('complete');
});

it('verifies a manually selected venue without requesting isochrones', async () => {
  const { result } = services();
  const completed = await calculateSelectedVenue({ ...outing, selectedVenue: venues[0]! }, result, Date.parse(meeting) - 3600000);
  expect(completed.progress?.stage).toBe('complete');
  expect(completed.recommendations).toHaveLength(1);
  expect(result.prim.isochrone).not.toHaveBeenCalled();
  expect(result.prim.journey).toHaveBeenCalledTimes(4);
  expect(completed.warnings.join(' ')).toContain('Lieu choisi manuellement');
});
it('rejects the selected venue when one participant has no return', async () => {
  const { result } = services();
  const original = result.prim.journey;
  result.prim.journey = vi.fn(async (from, to, at, direction, freshness) => direction === 'departure' && to === '2.37;48.87' ? { journeys: [], error: { id: 'no_solution' } } : original(from, to, at, direction, freshness));
  const completed = await calculateSelectedVenue({ ...outing, selectedVenue: venues[0]! }, result);
  expect(completed.recommendations).toEqual([]);
  expect(completed.progress?.stage).toBe('complete');
});
it('does not verify a manual venue that disappeared from the open catalogue', async () => {
  const { result } = services();
  result.venues = async () => [];
  const completed = await calculateSelectedVenue({ ...outing, selectedVenue: venues[0]! }, result);
  expect(completed.progress?.stage).toBe('failed');
  expect(result.prim.journey).not.toHaveBeenCalled();
});
