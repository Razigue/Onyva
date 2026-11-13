import { describe, expect, it } from 'vitest';
import type { Journey } from '@onyva/shared';
import { packStationTimes, unpackStationTimes, venueJourney } from './engine.ts';

// Synthetic journeys: invented stations and times, never the real network.
const venue = { id: 'osm:node:1', name: 'Le Comptoir', stationId: 'stop_area:IDFM:3', walkSeconds: 120 };
const T = 1_794_000_000;
function ride(departure: number, arrival: number): Journey & { transfers: number } {
  return {
    departure, arrival, duration: arrival - departure, night: false, transfers: 0,
    legs: [{ from: 'stop_area:IDFM:1', to: venue.stationId, fromName: 'Un', toName: 'Trois', departure, arrival, mode: 'transit', line: '1', night: false, routeId: 'IDFM:C1', stations: ['stop_area:IDFM:1', venue.stationId] } as Journey['legs'][number]],
  };
}

describe('venueJourney', () => {
  it('adds the walk to the venue, then waits until the meeting', () => {
    const journey = venueJourney(ride(T - 1800, T - 600), venue, T, 'arrival')!;
    expect(journey).toMatchObject({ departure: T - 1800, arrival: T, duration: 1800 });
    expect(journey.legs.map(leg => [leg.mode, leg.departure, leg.arrival])).toEqual([
      ['transit', T - 1800, T - 600], ['walk', T - 600, T - 480], ['wait', T - 480, T],
    ]);
    expect(journey.legs[1]).toMatchObject({ from: venue.stationId, to: venue.id, fromName: 'Trois', toName: 'Le Comptoir' });
    // Contract-only fields stay out of what the app stores.
    expect(journey.legs[0]).not.toHaveProperty('routeId');
    expect(journey.legs[0]).not.toHaveProperty('stations');
  });

  it('starts the return at the end of the outing with the walk back to the station', () => {
    const journey = venueJourney({ ...ride(T + 600, T + 2400), legs: ride(T + 600, T + 2400).legs.map(leg => ({ ...leg, from: venue.stationId, to: 'stop_area:IDFM:1', fromName: 'Trois', toName: 'Un' })) }, venue, T, 'departure')!;
    expect(journey).toMatchObject({ departure: T, arrival: T + 2400, duration: 2400 });
    expect(journey.legs.map(leg => leg.mode)).toEqual(['walk', 'wait', 'transit']);
    expect(journey.legs[0]).toMatchObject({ from: venue.id, to: venue.stationId, arrival: T + 120 });
  });

  it('fails closed when the train reaches the station too late to walk in time', () => {
    expect(venueJourney(ride(T - 1800, T - 60), venue, T, 'arrival')).toBeNull();
    expect(venueJourney(ride(T + 60, T + 1800), venue, T, 'departure')).toBeNull();
  });

  it('fails closed on a gap between legs or a walk above five minutes', () => {
    const broken = ride(T - 1800, T - 600);
    broken.legs = [{ ...broken.legs[0]!, arrival: T - 1200 }, { ...broken.legs[0]!, departure: T - 1100, arrival: T - 600 }];
    expect(venueJourney(broken, venue, T, 'arrival')).toBeNull();
    expect(venueJourney(ride(T - 1800, T - 600), { ...venue, walkSeconds: 301 }, T, 'arrival')).toBeNull();
  });

  it('keeps only the walk when the participant leaves from the venue station', () => {
    const same = { departure: T, arrival: T, duration: 0, legs: [], night: false };
    expect(venueJourney(same, venue, T, 'arrival')).toMatchObject({ departure: T - 120, duration: 120, legs: [{ mode: 'walk' }] });
    expect(venueJourney(same, venue, T, 'departure')).toMatchObject({ arrival: T + 120, duration: 120, legs: [{ mode: 'walk' }] });
  });
});

describe('station times cache', () => {
  it('round-trips catalogue stations and drops any other identifier', () => {
    const times = [{ stationId: 'stop_area:IDFM:71517', duration: 0 }, { stationId: 'stop_area:IDFM:473843', duration: 3540 }];
    expect(unpackStationTimes(packStationTimes([...times, { stationId: 'other:1', duration: 5 }]))).toEqual(times);
    expect(unpackStationTimes('')).toEqual([]);
    expect(() => unpackStationTimes('12:-1')).toThrow();
  });
});
