import { expect, it } from 'vitest';
import { compileNetwork } from '@onyva/transit-engine';
import { syntheticSource } from '../packages/transit-engine/src/synthetic.ts';
import { lineLabel, stationLines } from '../scripts/engine/import-stations.ts';

// Synthetic network: invented stations and lines, never the real IDFM network.
it('labels GTFS routes as riders know them', () => {
  expect(lineLabel('4', 1)).toBe('M4');
  expect(lineLabel('B', 2)).toBe('RER B');
  expect(lineLabel('L', 2)).toBe('L');
  expect(lineLabel('T3a', 0)).toBe('T3a');
  expect(lineLabel('FUN', 7)).toBe('Funiculaire');
  expect(lineLabel('38', 3)).toBe('38');
});

it('lists rail before buses, buses in numeric order, ten lines at most', async () => {
  const buses = Array.from({ length: 12 }, (_, i) => ({ id: `B${i}`, name: String(100 - i * 5), type: 3 }));
  const routes = [...buses, { id: 'M', name: '7', type: 1 }, { id: 'R', name: 'A', type: 2 }];
  const network = await compileNetwork(syntheticSource({
    stations: [{ id: 'IDFM:1' }, { id: 'IDFM:2' }, { id: 'IDFM:3' }],
    routes,
    trips: routes.map(route => ({ id: `t${route.id}`, route: route.id, service: 'WK', stops: [['IDFM:11', '08:00:00'], ['IDFM:21', '08:10:00']] as Array<[string, string]> })),
    calendar: [{ service: 'WK', days: '1111100' }],
  }), { feedSha256: 'synthetic', builtAt: '2026-11-06T00:00:00.000Z' });
  const lines = stationLines(network);
  expect(lines.get('stop_area:IDFM:1')).toEqual(['M7', 'RER A', '45', '50', '55', '60', '65', '70', '75', '80']);
  expect(lines.has('stop_area:IDFM:3')).toBe(false);
});
