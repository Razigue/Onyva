import type { Journey, Station } from './index';

/** Synthetic test fixtures. The account-free app uses the timetable with a separate real OSM venue catalog. Never used in live mode. */
export const demoStations: Station[] = [
  { id: 'bastille', name: 'Bastille', lines: ['1', '5', '8'], latitude: 48.853, longitude: 2.369 },
  { id: 'montreuil', name: 'Mairie de Montreuil', lines: ['9'], latitude: 48.862, longitude: 2.442 },
  { id: 'place-italie', name: 'Place d’Italie', lines: ['5', '6', '7'], latitude: 48.831, longitude: 2.356 },
  { id: 'saint-lazare', name: 'Saint-Lazare', lines: ['3', '12', '13', '14'], latitude: 48.875, longitude: 2.325 },
  { id: 'republique', name: 'République', lines: ['3', '5', '8', '9', '11'], latitude: 48.867, longitude: 2.363 },
  { id: 'chatelet', name: 'Châtelet', lines: ['1', '4', '7', '11', '14'], latitude: 48.859, longitude: 2.347 },
  { id: 'oberkampf', name: 'Oberkampf', lines: ['5', '9'], latitude: 48.864, longitude: 2.369 },
  { id: 'nation', name: 'Nation', lines: ['1', '2', '6', '9', 'A'], latitude: 48.848, longitude: 2.395 },
];

export function demoPlanner(from: string, to: string, time: number, direction: 'arriveBy' | 'departAfter'): Journey | null {
  if (!demoStations.some(s => s.id === from) || !demoStations.some(s => s.id === to)) return null;
  if (from === to) return { departure: time, arrival: time, duration: 0, legs: [], night: false };
  const candidates = ['republique', 'chatelet', 'oberkampf', 'nation', 'bastille'];
  const durations = [[12,22,19,18,0,10,4,17],[15,28,16,13,10,0,12,19],[10,18,25,24,4,12,0,14],[10,21,18,20,17,19,14,0],[0,24,15,16,12,15,10,10]];
  const ci = candidates.indexOf(to), origin = demoStations.findIndex(s => s.id === from);
  const seconds = (durations[ci]?.[origin] ?? 22) * 60;
  const departure = direction === 'arriveBy' ? time - seconds - 180 : time;
  const arrival = departure + seconds + 180;
  return { departure, arrival, duration: seconds + 180, night: false, legs: [
    { from, to: from, departure, arrival: departure + 180, mode: 'wait' },
    { from, to, departure: departure + 180, arrival, mode: 'transit', line: 'Démo' },
  ] };
}
