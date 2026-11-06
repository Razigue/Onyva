// Synthetic GTFS networks for tests. They are invented and never describe the real IDFM network.
import type { GtfsRow } from './csv.ts';
import type { GtfsSource } from './compile.ts';

export interface SyntheticTrip { id: string; route: string; service: string; stops: Array<[stop: string, time: string, pickup?: number, dropOff?: number]> }
export interface SyntheticFeed {
  stations: Array<{ id: string; platforms?: string[]; lat?: number; lon?: number }>;
  routes: Array<{ id: string; name: string; type?: number }>;
  trips: SyntheticTrip[];
  calendar: Array<{ service: string; days: string; start?: string; end?: string }>;
  calendarDates?: Array<{ service: string; date: string; type: 1 | 2 }>;
  transfers?: Array<{ from: string; to: string; seconds: number }>;
}

export function syntheticSource(feed: SyntheticFeed): GtfsSource {
  const stops: GtfsRow[] = [];
  feed.stations.forEach((station, index) => {
    const lat = String(station.lat ?? 48.85 + index * 0.001), lon = String(station.lon ?? 2.35);
    stops.push({ stop_id: station.id, stop_name: `Station ${station.id}`, location_type: '1', parent_station: '', stop_lat: lat, stop_lon: lon });
    for (const platform of station.platforms ?? [`${station.id}1`]) stops.push({ stop_id: platform, stop_name: `Quai ${platform}`, location_type: '0', parent_station: station.id, stop_lat: lat, stop_lon: lon });
  });
  const names = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  return {
    stops,
    routes: feed.routes.map(route => ({ route_id: route.id, route_short_name: route.name, route_long_name: '', route_type: String(route.type ?? 3) })),
    trips: feed.trips.map(trip => ({ trip_id: trip.id, route_id: trip.route, service_id: trip.service })),
    stopTimes: feed.trips.flatMap(trip => trip.stops.map(([stop, time, pickup, dropOff], index) => ({
      trip_id: trip.id, stop_id: stop, stop_sequence: String(index + 1), arrival_time: time, departure_time: time,
      pickup_type: String(pickup ?? 0), drop_off_type: String(dropOff ?? 0),
    }))),
    calendar: feed.calendar.map(entry => ({
      service_id: entry.service, start_date: entry.start ?? '20261102', end_date: entry.end ?? '20261204',
      ...Object.fromEntries(names.map((name, i) => [name, entry.days[i] ?? '0'])),
    })),
    calendarDates: (feed.calendarDates ?? []).map(entry => ({ service_id: entry.service, date: entry.date, exception_type: String(entry.type) })),
    transfers: (feed.transfers ?? []).map(entry => ({ from_stop_id: entry.from, to_stop_id: entry.to, transfer_type: '2', min_transfer_time: String(entry.seconds) })),
  };
}

/** Paris time in November 2026 (UTC+1) to epoch seconds. */
export const paris = (date: string, time: string) => Date.parse(`${date}T${time}:00+01:00`) / 1000;
