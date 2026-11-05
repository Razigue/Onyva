import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { z } from 'zod';
import { primJourneysSchema } from '@onyva/shared';
import { rankStations, readIsochrone, readJourney } from './prim';
const path = 'packages/fairness/fixtures/prim-recorded.json';
it.skipIf(!existsSync(path))(
  'replays authentic recorded PRIM responses when credentials allowed capture',
  () => {
    const fixture = z.object({
      provenance: z.object({
        capturedFromPrim: z.literal(true),
        capturedAt: z.string().datetime(),
      }),
      meetingAt: z.string().datetime(),
      endsAt: z.string().datetime(),
      participants: z.array(
        z.object({
          participantId: z.string(),
          isochrone: primJourneysSchema,
          outbound: primJourneysSchema,
          inbound: primJourneysSchema,
        }),
      ).min(2),
    }).parse(JSON.parse(readFileSync(path, 'utf8')));
    const ranked = rankStations(
      fixture.participants.map((p) => ({
        participantId: p.participantId,
        times: readIsochrone(p.isochrone),
      })),
    );
    expect(ranked.length).toBeGreaterThan(0);
    for (const participant of fixture.participants) {
      const outbound = readJourney(
        participant.outbound,
        Date.parse(fixture.meetingAt) / 1000,
        'arrival',
      );
      const inbound = readJourney(
        participant.inbound,
        Date.parse(fixture.endsAt) / 1000,
        'departure',
      );
      expect(outbound).not.toBeNull();
      expect(inbound).not.toBeNull();
    }
  },
);

it('replays the first real PRIM detailed journeys and rejects an unmapped isochrone stop', () => {
  const probe = JSON.parse(readFileSync('packages/fairness/fixtures/prim-probe-recorded.json', 'utf8'));
  expect(probe.provenance.capturedFromPrim).toBe(true);
  expect(readJourney(probe.outbound, Date.parse(probe.meetingAt) / 1000, 'arrival')).not.toBeNull();
  expect(readJourney(probe.inbound, Date.parse(probe.endsAt) / 1000, 'departure')).not.toBeNull();
  expect(() => readIsochrone(probe.isochroneFragment)).toThrow('station parente');
});

it('accepts a real zero-duration station connection without treating a nonzero crow-fly estimate as an exact walk', () => {
  const captured = JSON.parse(readFileSync('packages/fairness/fixtures/prim-zero-connection.json', 'utf8'));
  expect(captured.provenance.capturedFromPrim).toBe(true);
  expect(readJourney(captured.response, Date.parse(captured.at) / 1000, 'arrival')).not.toBeNull();
  expect(readJourney({ journeys: [{ duration: 60, departure_date_time: '20261104T180000', arrival_date_time: '20261104T180100', sections: [{ type: 'crow_fly', mode: 'walking', departure_date_time: '20261104T180000', arrival_date_time: '20261104T180100' }] }] }, Date.parse('2026-11-04T18:00:00Z') / 1000, 'arrival')).toBeNull();
});
