import { describe, expect, it } from 'vitest';
import { compileNetwork } from './compile.ts';
import { csvRows, parseCsvLine } from './csv.ts';
import { OutOfValidityError, TransitEngine } from './engine.ts';
import type { EngineJourney, JourneyResult } from './engine.ts';
import { deserializeNetwork, serializeNetwork } from './snapshot.ts';
import { paris, syntheticSource } from './synthetic.ts';
import type { SyntheticFeed } from './synthetic.ts';
import { serviceDayStart, gtfsDateToDay } from './time.ts';

// All networks below are synthetic: invented stations, lines and times.
const weekdays = { service: 'WK', days: '1111100' };
const id = (station: string) => `stop_area:${station}`;
const MONDAY = '2026-11-09';
async function engine(feed: SyntheticFeed, options = {}) {
  return new TransitEngine(await compileNetwork(syntheticSource(feed), { feedSha256: 'synthetic' }), options);
}
function ok(result: JourneyResult): EngineJourney {
  if (result.status !== 'ok') throw new Error(`Expected a journey, got ${result.reason}`);
  return result.journey;
}
const line = (trip: string, route: string, stops: SyntheticFeed['trips'][number]['stops'], service = 'WK') => ({ id: trip, route, service, stops });

describe('CSV', () => {
  it('reads quoted fields and strips the byte order mark', async () => {
    expect(parseCsvLine('a,"b, c","d ""e"""')).toEqual(['a', 'b, c', 'd "e"']);
    const rows = [];
    for await (const row of csvRows(['﻿stop_id,stop_name', 'S1,"Gare, Nord"'])) rows.push(row);
    expect(rows).toEqual([{ stop_id: 'S1', stop_name: 'Gare, Nord' }]);
  });
});

describe('service days', () => {
  it('starts a service day at noon minus 12 h, one hour off midnight on DST change days', () => {
    expect(serviceDayStart(gtfsDateToDay('20261109'))).toBe(paris(MONDAY, '00:00'));
    // 25 October 2026: Paris moves from UTC+2 to UTC+1, noon minus 12 h is 23:00 the day before in local time.
    expect(serviceDayStart(gtfsDateToDay('20261025'))).toBe(Date.parse('2026-10-25T12:00:00+01:00') / 1000 - 12 * 3600);
  });
});

describe('journeys on a synthetic network', () => {
  const base: SyntheticFeed = {
    stations: [{ id: 'A' }, { id: 'B', platforms: ['B1', 'B2'] }, { id: 'C' }],
    routes: [{ id: 'R1', name: '1', type: 1 }, { id: 'R2', name: '2', type: 1 }],
    trips: [
      line('t1', 'R1', [['A1', '08:00:00'], ['B1', '08:10:00']]),
      line('t2', 'R2', [['B2', '08:12:00'], ['C1', '08:20:00']]),
      line('t3', 'R2', [['B2', '08:20:00'], ['C1', '08:28:00']]),
    ],
    calendar: [weekdays],
    transfers: [{ from: 'B1', to: 'B2', seconds: 180 }, { from: 'B2', to: 'B1', seconds: 180 }],
  };

  it('misses a connection that the footpath time does not allow', async () => {
    const e = await engine(base);
    const journey = ok(e.journey({ from: id('A'), to: id('C'), time: paris(MONDAY, '07:55'), direction: 'departAfter' }));
    expect(journey.arrival).toBe(paris(MONDAY, '08:28'));
    expect(journey.transfers).toBe(1);
    expect(journey.legs.map(leg => leg.mode)).toEqual(['transit', 'walk', 'wait', 'transit']);
    expect(journey.legs[0]).toMatchObject({ from: id('A'), to: id('B'), line: '1', stations: [id('A'), id('B')] });
  });

  it('chooses the latest departure that still arrives on time', async () => {
    const feed = { ...base, trips: [...base.trips, line('t0', 'R1', [['A1', '07:40:00'], ['B1', '07:50:00']])] };
    const e = await engine(feed);
    const journey = ok(e.journey({ from: id('A'), to: id('C'), time: paris(MONDAY, '08:25'), direction: 'arriveBy' }));
    expect(journey.departure).toBe(paris(MONDAY, '07:40'));
    expect(journey.arrival).toBe(paris(MONDAY, '08:20'));
    const later = ok(e.journey({ from: id('A'), to: id('C'), time: paris(MONDAY, '08:30'), direction: 'arriveBy' }));
    expect(later.departure).toBe(paris(MONDAY, '08:00'));
  });

  it('applies the same platform change time', async () => {
    const feed: SyntheticFeed = {
      stations: [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
      routes: [{ id: 'R1', name: '1' }, { id: 'R2', name: '2' }],
      trips: [
        line('t1', 'R1', [['A1', '08:00:00'], ['B1', '08:10:00']]),
        line('fast', 'R2', [['B1', '08:10:30'], ['C1', '08:15:00']]),
        line('slow', 'R2', [['B1', '08:11:00'], ['C1', '08:16:00']]),
      ],
      calendar: [weekdays],
    };
    const e = await engine(feed, { sameStopTransferSeconds: 60 });
    expect(ok(e.journey({ from: id('A'), to: id('C'), time: paris(MONDAY, '07:59'), direction: 'departAfter' })).arrival).toBe(paris(MONDAY, '08:16'));
  });

  it('handles trips after midnight on the previous service day', async () => {
    const feed: SyntheticFeed = { stations: [{ id: 'A' }, { id: 'B' }], routes: [{ id: 'N', name: 'N1' }], trips: [line('night', 'N', [['A1', '24:30:00'], ['B1', '25:05:00']])], calendar: [weekdays] };
    const e = await engine(feed);
    const journey = ok(e.journey({ from: id('A'), to: id('B'), time: paris('2026-11-10', '00:10'), direction: 'departAfter' }));
    expect(journey.departure).toBe(paris('2026-11-10', '00:30'));
    expect(journey.night).toBe(true);
    // Saturday 14: Friday's service still runs after midnight, Saturday's does not exist.
    expect(ok(e.journey({ from: id('A'), to: id('B'), time: paris('2026-11-14', '00:10'), direction: 'departAfter' })).arrival).toBe(paris('2026-11-14', '01:05'));
    expect(e.journey({ from: id('A'), to: id('B'), time: paris('2026-11-15', '00:10'), direction: 'departAfter' })).toEqual({ status: 'none', reason: 'no-service' });
  });

  it('removes a public holiday through calendar_dates', async () => {
    const feed: SyntheticFeed = { ...base, calendarDates: [{ service: 'WK', date: '20261111', type: 2 }] };
    const e = await engine(feed);
    expect(e.journey({ from: id('A'), to: id('B'), time: paris('2026-11-11', '07:55'), direction: 'departAfter' })).toEqual({ status: 'none', reason: 'no-service' });
    expect(ok(e.journey({ from: id('A'), to: id('B'), time: paris('2026-11-12', '07:55'), direction: 'departAfter' })).arrival).toBe(paris('2026-11-12', '08:10'));
  });

  it('refuses boarding where pickup is forbidden and tells when only on-demand service exists', async () => {
    const forbidden = await engine({ ...base, trips: [line('t1', 'R1', [['A1', '08:00:00', 1], ['B1', '08:10:00']])] });
    expect(forbidden.journey({ from: id('A'), to: id('B'), time: paris(MONDAY, '07:55'), direction: 'departAfter' })).toEqual({ status: 'none', reason: 'no-service' });
    const onDemand = await engine({ ...base, trips: [line('t1', 'R1', [['A1', '08:00:00', 2], ['B1', '08:10:00']])] });
    expect(onDemand.journey({ from: id('A'), to: id('B'), time: paris(MONDAY, '07:55'), direction: 'departAfter' })).toEqual({ status: 'none', reason: 'on-demand-only' });
    expect(onDemand.journey({ from: id('A'), to: id('B'), time: paris(MONDAY, '08:30'), direction: 'arriveBy' })).toEqual({ status: 'none', reason: 'on-demand-only' });
  });

  it('keeps an overtaking express in its own RAPTOR route', async () => {
    const feed: SyntheticFeed = {
      stations: [{ id: 'A' }, { id: 'B' }], routes: [{ id: 'R1', name: '1' }],
      trips: [line('slow', 'R1', [['A1', '08:00:00'], ['B1', '08:40:00']]), line('express', 'R1', [['A1', '08:05:00'], ['B1', '08:20:00']])],
      calendar: [weekdays],
    };
    const e = await engine(feed);
    expect(e.network.meta.stats.patterns).toBe(2);
    expect(ok(e.journey({ from: id('A'), to: id('B'), time: paris(MONDAY, '07:59'), direction: 'departAfter' })).arrival).toBe(paris(MONDAY, '08:20'));
  });

  it('leaves out past days that the publisher only kept partially', async () => {
    const trip = (n: number, service: string) => line(`${service}${n}`, 'R1', [['A1', `0${n}:00:00`], ['B1', `0${n}:10:00`]], service);
    const e = await engine({ ...base, trips: [trip(1, 'OLD'), ...[1, 2, 3, 4].map(n => trip(n, 'WK'))], calendar: [{ service: 'OLD', days: '1111111', start: '20261102', end: '20261104' }, { service: 'WK', days: '1111111', start: '20261105', end: '20261204' }] });
    expect(e.validity()).toEqual({ validFrom: '2026-11-05', validUntil: '2026-12-04' });
    expect(() => e.journey({ from: id('A'), to: id('B'), time: paris('2026-11-04', '00:30'), direction: 'departAfter' })).toThrow(OutOfValidityError);
  });

  it('refuses dates outside the feed validity instead of computing for now', async () => {
    const e = await engine(base);
    expect(() => e.journey({ from: id('A'), to: id('B'), time: paris('2026-12-25', '08:00'), direction: 'departAfter' })).toThrow(OutOfValidityError);
    expect(() => e.oneToAll({ origin: id('A'), arriveBy: paris('2026-10-01', '08:00') })).toThrow(OutOfValidityError);
  });
});

describe('one to all', () => {
  const feed: SyntheticFeed = {
    stations: [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }, { id: 'Z' }],
    routes: [{ id: 'R1', name: '1' }],
    trips: [
      line('t1', 'R1', [['A1', '08:00:00'], ['B1', '08:10:00'], ['C1', '08:20:00']]),
      line('t2', 'R1', [['A1', '08:30:00'], ['B1', '08:40:00'], ['C1', '08:50:00']]),
    ],
    calendar: [weekdays],
    transfers: [{ from: 'C1', to: 'D1', seconds: 300 }],
  };

  it('gives every station the latest departure that arrives by the meeting time, waits included', async () => {
    const e = await engine(feed);
    const result = e.oneToAll({ origin: id('A'), arriveBy: paris(MONDAY, '08:45') });
    const byId = Object.fromEntries(result.durations.map(entry => [entry.stationId, entry]));
    // B: the 08:30 trip arrives at 08:40, so leaving at 08:30 gives 15 min including the wait at B.
    expect(byId[id('B')]).toMatchObject({ latestDeparture: paris(MONDAY, '08:30'), duration: 15 * 60, transfers: 0 });
    // C: the 08:30 trip arrives too late at 08:50, the 08:00 trip is needed.
    expect(byId[id('C')]).toMatchObject({ latestDeparture: paris(MONDAY, '08:00'), duration: 45 * 60 });
    // D: 08:20 at C, then 5 min on foot.
    expect(byId[id('D')]).toMatchObject({ latestDeparture: paris(MONDAY, '08:00') });
    expect(byId[id('A')]).toMatchObject({ duration: 0 });
    expect(byId[id('Z')]).toBeUndefined();
    expect(result.unreachable).toBe(1);
  });

  it('agrees with a dedicated arrive-by journey for each station', async () => {
    const e = await engine(feed);
    const at = paris(MONDAY, '08:45');
    for (const entry of e.oneToAll({ origin: id('A'), arriveBy: at }).durations) {
      if (entry.stationId === id('A')) continue;
      expect(ok(e.journey({ from: id('A'), to: entry.stationId, time: at, direction: 'arriveBy' })).departure).toBe(entry.latestDeparture);
    }
  });

  it('respects the window and the requested targets', async () => {
    const e = await engine(feed);
    const result = e.oneToAll({ origin: id('A'), arriveBy: paris(MONDAY, '08:45'), window: 30 * 60, targets: [id('B'), id('C')] });
    expect(result.durations.map(entry => entry.stationId)).toEqual([id('B')]);
    expect(result.unreachable).toBe(1);
  });
});

describe('snapshot', () => {
  it('gives identical answers after a binary round trip', async () => {
    const feed: SyntheticFeed = { stations: [{ id: 'A' }, { id: 'B' }], routes: [{ id: 'R1', name: '1' }], trips: [line('t1', 'R1', [['A1', '08:00:00'], ['B1', '08:10:00']])], calendar: [weekdays] };
    const network = await compileNetwork(syntheticSource(feed), { feedSha256: 'synthetic', builtAt: '2026-11-06T00:00:00.000Z' });
    const bytes = serializeNetwork(network), copy = deserializeNetwork(bytes);
    expect(copy.meta).toEqual(network.meta);
    expect(Array.from(copy.departures)).toEqual(Array.from(network.departures));
    const query = { from: id('A'), to: id('B'), time: paris(MONDAY, '07:00'), direction: 'departAfter' as const };
    expect(new TransitEngine(copy).journey(query)).toEqual(new TransitEngine(network).journey(query));
    const shifted = new Uint8Array(bytes.length + 3); shifted.set(bytes, 3);
    expect(deserializeNetwork(shifted.subarray(3)).meta).toEqual(network.meta);
  });
});
