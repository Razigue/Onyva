import { expect, it } from 'vitest';
import {
  compareScores,
  rankStations,
  readIsochrone,
  readJourney,
  shortlistVenues,
  verifiedRecommendation,
} from './prim';
import { primJourneysSchema } from '@onyva/shared';
import type { Venue } from '@onyva/shared';
import fixture from '../fixtures/navitia-contract.json';
const scores = () =>
  rankStations(
    fixture.participants.map((p) => ({
      participantId: p.participantId,
      times: readIsochrone(p.response),
    })),
  );
const venue: Venue = {
  id: 'osm-node-1',
  name: 'Café',
  stationId: 'station-a',
  neighborhood: 'Paris',
  kind: 'dinner',
  cuisines: ['french'],
  walkSeconds: 120,
  longitude: 2.36,
  latitude: 48.86,
  openIntervals: [{ start: 0, end: 9999999999 }],
  source: 'osm',
};
it('ranks common stations by maximum, sum, spread and excludes unreachable stations', () => {
  expect(scores().map((s) => s.stationId)).toEqual(['station-a', 'station-b']);
  expect(scores()[0]).toMatchObject({ maximum: 1200, sum: 2400, spread: 0 });
  expect(compareScores({ maximum: 10, sum: 12, spread: 8 }, { maximum: 10, sum: 13, spread: 1 }))
    .toBeLessThan(0);
  expect(compareScores({ maximum: 10, sum: 12, spread: 1 }, { maximum: 10, sum: 12, spread: 2 }))
    .toBeLessThan(0);
  expect(rankStations([{ participantId: 'x', times: [] }])).toEqual([]);
});
it('rejects incomplete isochrones and does not guess missing durations', () => {
  expect(() => readIsochrone({ journeys: [], pagination: { total_result: 20, items_on_page: 10 } }))
    .toThrow('incomplet');
  expect(() => readIsochrone({ journeys: [{ to: { id: 'a' } }] })).toThrow();
  expect(readIsochrone({ journeys: [] })).toEqual([]);
});
it('shortlists at most three known-open nearby venues and keeps the station minimax winner', () => {
  const venues = [
    venue,
    { ...venue, id: 'closed', openIntervals: [] },
    { ...venue, id: 'far', walkSeconds: 301 },
    ...Array.from(
      { length: 6 },
      (_, i) => ({ ...venue, id: `alternative-${i}`, walkSeconds: 130 + i }),
    ),
  ];
  const selected = shortlistVenues(scores(), venues, 100, 200, 'dinner');
  expect(selected).toHaveLength(3);
  expect(selected[0]?.id).toBe(venue.id);
  expect(selected.some((v) => v.id === 'closed' || v.id === 'far')).toBe(false);
});
it('spreads the shortlist over distinct stations in the minimax order', () => {
  const venues: Venue[] = [
    { ...venue, id: 'a-1', stationId: 'station-a', walkSeconds: 60, cuisines: ['french'] },
    { ...venue, id: 'a-2', stationId: 'station-a', walkSeconds: 90, cuisines: ['italian'] },
    { ...venue, id: 'b-1', stationId: 'station-b', walkSeconds: 200, cuisines: ['french'] },
    { ...venue, id: 'b-2', stationId: 'station-b', walkSeconds: 250, cuisines: ['japanese'] },
  ];
  // Station a ranks first: its closest venue leads, then station b with a new cuisine, then the best station again.
  expect(shortlistVenues(scores(), venues, 100, 200, 'dinner').map((v) => v.id)).toEqual(['a-1', 'b-2', 'a-2']);
  expect(shortlistVenues(scores(), venues.map((v) => ({ ...v, kind: 'drinks' as const })), 100, 200, 'drinks').map((v) => v.id))
    .toEqual(['a-1', 'b-1', 'a-2']);
  expect(shortlistVenues(scores(), venues, 100, 200, 'dinner', 2).map((v) => v.stationId)).toEqual(['station-a', 'station-b']);
});
const raw = (night = false) =>
  primJourneysSchema.parse({
    journeys: [{
      duration: 1200,
      departure_date_time: '20261102T190000',
      arrival_date_time: '20261102T192000',
      sections: [{
        type: 'street_network',
        mode: 'walking',
        departure_date_time: '20261102T190000',
        arrival_date_time: '20261102T190200',
        from: { id: 'home' },
        to: { id: 'a' },
      }, {
        type: 'public_transport',
        departure_date_time: '20261102T190500',
        arrival_date_time: '20261102T191800',
        from: { id: 'a' },
        to: { id: 'b' },
        display_informations: { code: night ? 'N01' : '5' },
      }, {
        type: 'street_network',
        mode: 'walking',
        departure_date_time: '20261102T191800',
        arrival_date_time: '20261102T192000',
        from: { id: 'b' },
        to: { id: 'venue' },
      }],
    }],
  });
it('includes waiting, transfers, walking and the requested meeting time', () => {
  const time = Date.parse('2026-11-02T18:25:00Z') / 1000;
  const trip = readJourney(raw(), time, 'arrival')!;
  expect(trip.duration).toBe(1500);
  expect(trip.arrival).toBe(time);
  expect(trip.legs.some((leg) => leg.mode === 'wait' && leg.arrival - leg.departure === 180)).toBe(
    true,
  );
  expect(readJourney(raw(true), time, 'arrival')?.night).toBe(true);
  expect(readJourney(raw(), time - 1800, 'arrival')).toBeNull();
});
it('excludes any venue without an independently verified return for each participant', () => {
  const journey = readJourney(raw(), Date.parse('2026-11-02T18:25:00Z') / 1000, 'arrival')!;
  const people = ['alice', 'bob'].map((id) => ({
    id,
    userId: null,
    name: id,
    departureId: 'home',
    returnId: 'home',
  }));
  expect(
    verifiedRecommendation(venue, people, [{
      participantId: 'alice',
      outbound: journey,
      inbound: journey,
    }]),
  ).toBeNull();
  expect(
    verifiedRecommendation(
      venue,
      people,
      people.map((p) => ({ participantId: p.id, outbound: journey, inbound: journey })),
    )?.maximum,
  ).toBe(1500);
});
it('rejects a disrupted theoretical itinerary whose amended times are not verified', () => {
  const response = raw();
  response.journeys[0]!.status = 'SIGNIFICANT_DELAYS';
  const time = Date.parse('2026-11-02T18:25:00Z') / 1000;
  expect(readJourney(response, time, 'arrival')).toBeNull();
  response.journeys[0]!.sections!.find(section => section.type === 'public_transport')!.data_freshness = 'realtime';
  expect(readJourney(response, time, 'arrival')).not.toBeNull();
});
it('processes ten participant isochrones within the three-second local computation budget', () => {
  const inputs = Array.from(
    { length: 10 },
    (_, i) => ({
      participantId: `p${i}`,
      times: Array.from(
        { length: 1000 },
        (_, j) => ({ stationId: `s${j}`, duration: 600 + ((j * 13 + i * 31) % 3600) }),
      ),
    }),
  );
  const started = performance.now();
  const result = rankStations(inputs);
  const elapsed = performance.now() - started;
  console.info(`Classement pur : ${elapsed.toFixed(1)} ms pour 10 participants et 1 000 stations.`);
  expect(result).toHaveLength(1000);
  expect(elapsed).toBeLessThan(3000);
});

it('rejects saturated PRIM responses without pagination and stops without a parent station', () => {
  const journey = { duration: 60, departure_date_time: '20261104T180000', arrival_date_time: '20261104T180100', to: { id: 'stop_area:test' } };
  expect(() => readIsochrone({ journeys: Array.from({ length: 1000 }, () => journey) }))
    .toThrow('Isochrone incomplet');
  expect(() => readIsochrone({ journeys: [{ ...journey, to: {
    id: 'stop_point:test', stop_point: { id: 'stop_point:test' },
  } }] })).toThrow('station parente');
});
