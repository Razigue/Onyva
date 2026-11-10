import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TransitEngine } from './engine.ts';
import { deserializeNetwork } from './snapshot.ts';

// Independent references: 20 real PRIM journeys captured on 10 November 2026, station to station, base schedule
// (fixtures/prim-references-2026-11-10.json, captured by `pnpm engine:record-references`).
// Comparison on the public transport core of each PRIM journey: from its first boarding station to its last alighting station.
// Navitia does not always return the earliest arrival (it may prefer fewer changes), so the check is one-sided:
// the engine must never be more than 5 minutes worse than PRIM. Gains beyond 5 minutes are printed for review.
// Skipped when no snapshot is compiled locally, notably in CI.
const TOLERANCE = 5 * 60;
const dir = 'data/engine';
const file = existsSync(dir) ? readdirSync(dir).filter(name => name.endsWith('.bin')).sort((a, b) => statSync(join(dir, b)).mtimeMs - statSync(join(dir, a)).mtimeMs)[0] : undefined;

interface Section { type: string; departure: string; arrival: string; from?: string; to?: string; line?: string }
interface Reference { label: string; from: string; to: string; at: string; direction: 'departure' | 'arrival'; journey: { departure: string; arrival: string; sections: Section[] } | null }
const fixture = JSON.parse(readFileSync(join(import.meta.dirname, '../fixtures/prim-references-2026-11-10.json'), 'utf8')) as { references: Reference[] };
// PRIM times are Paris local time, UTC+1 for every captured date.
const paris = (value: string) => Date.parse(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}+01:00`) / 1000;
const minutes = (seconds: number) => `${seconds >= 0 ? '+' : ''}${Math.round(seconds / 6) / 10} min`;

describe.skipIf(!file)('20 PRIM references of 10 November 2026 on the real GTFS snapshot', () => {
  const engine = file ? new TransitEngine(deserializeNetwork(readFileSync(join(dir, file)))) : null;
  it('covers 20 captured journeys', () => {
    expect(fixture.references).toHaveLength(20);
    expect(fixture.references.every(reference => reference.journey)).toBe(true);
  });
  for (const reference of fixture.references) {
    it(reference.label, () => {
      const transit = reference.journey!.sections.filter(section => section.type === 'public_transport');
      const first = transit[0]!, last = transit[transit.length - 1]!;
      expect(first.from && last.to).toBeTruthy();
      const lines = (journey: { legs: Array<{ mode: string; line?: string }> }) => journey.legs.filter(leg => leg.mode === 'transit').map(leg => leg.line).join(' + ');
      const prim = transit.map(section => section.line).join(' + ');
      if (reference.direction === 'departure') {
        const result = engine!.journey({ from: first.from!, to: last.to!, time: paris(first.departure), direction: 'departAfter' });
        expect(result.status).toBe('ok');
        if (result.status !== 'ok') return;
        const gap = result.journey.arrival - paris(last.arrival);
        console.info(`${reference.label} : arrivée ${minutes(gap)} par rapport à PRIM, moteur ${lines(result.journey)}, PRIM ${prim}`);
        expect(gap).toBeLessThanOrEqual(TOLERANCE);
      } else {
        const result = engine!.journey({ from: first.from!, to: last.to!, time: paris(last.arrival), direction: 'arriveBy' });
        expect(result.status).toBe('ok');
        if (result.status !== 'ok') return;
        const gap = paris(first.departure) - result.journey.departure;
        console.info(`${reference.label} : départ ${minutes(-gap)} par rapport à PRIM, moteur ${lines(result.journey)}, PRIM ${prim}`);
        expect(gap).toBeLessThanOrEqual(TOLERANCE);
      }
    });
  }
});
