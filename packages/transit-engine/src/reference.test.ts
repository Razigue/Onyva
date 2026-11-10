import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TransitEngine } from './engine.ts';
import { deserializeNetwork } from './snapshot.ts';

// Independent references: transit sections of real PRIM answers recorded on 4 November 2026
// (packages/fairness/fixtures). Station-to-station comparison on the GTFS snapshot of 5 November 2026.
// The feed published on 5 November only keeps a few trips of 4 November, so each reference is replayed on the
// same weekday two weeks later (Wednesday 18 November), assuming an unchanged regular timetable: to verify.
// Tolerance: 5 minutes on the arrival. Skipped when no snapshot is compiled locally.
const TOLERANCE = 5 * 60;
const dir = 'data/engine';
const file = existsSync(dir) ? readdirSync(dir).filter(name => name.endsWith('.bin')).sort((a, b) => statSync(join(dir, b)).mtimeMs - statSync(join(dir, a)).mtimeMs)[0] : undefined;
const SHIFT = 14 * 86_400;
const paris = (value: string) => Date.parse(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}+01:00`) / 1000 + SHIFT;

const references = [
  { label: 'RER C Saint-Michel Notre-Dame vers Champ de Mars Tour Eiffel, aller', from: 'stop_area:IDFM:73620', to: 'stop_area:IDFM:73844', leave: '20261104T183340', primArrival: '20261104T184350' },
  { label: 'RER C Champ de Mars Tour Eiffel vers Saint-Michel Notre-Dame, retour', from: 'stop_area:IDFM:73844', to: 'stop_area:IDFM:73620', leave: '20261104T214240', primArrival: '20261104T215210' },
  { label: 'Bus 111 puis métro 8, avec correspondance', from: 'stop_area:IDFM:426135', to: 'stop_area:IDFM:463564', leave: '20261104T183100', primArrival: '20261104T185415' },
];

describe.skipIf(!file)('PRIM references on the real GTFS snapshot', () => {
  const engine = file ? new TransitEngine(deserializeNetwork(readFileSync(join(dir, file)))) : null;
  for (const reference of references) {
    it(reference.label, () => {
      const result = engine!.journey({ from: reference.from, to: reference.to, time: paris(reference.leave), direction: 'departAfter' });
      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      const gap = result.journey.arrival - paris(reference.primArrival);
      console.info(`${reference.label} : écart d’arrivée ${gap} s, ${result.journey.transfers} correspondance(s), lignes ${result.journey.legs.filter(leg => leg.mode === 'transit').map(leg => leg.line).join(' + ')}`);
      expect(Math.abs(gap)).toBeLessThanOrEqual(TOLERANCE);
    });
  }
});
