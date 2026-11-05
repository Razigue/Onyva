import { expect, it } from 'vitest';
import type { Outing, Venue } from './index';
import { calendarEvent, outingCalendarFile } from './calendar';

const outing: Outing = { id: '00000000-0000-4000-8000-000000000001', ownerId: 'owner', inviteCode: '00000000-0000-4000-8000-000000000002', startsAt: '2026-11-02T18:30:00Z', endsAt: '2026-11-02T21:00:00Z', activity: 'dinner', participants: [], confirmedVenueId: 'cafe', updatedAt: '2026-11-02T12:00:00Z', mode: 'live' };
const venue: Venue = { id: 'cafe', name: 'Café, Étoile; Paris\nÉtage', stationId: 'a', neighborhood: 'République', kind: 'dinner', walkSeconds: 120, latitude: 48.86, longitude: 2.36, openIntervals: [], source: 'osm' };

it('exports the confirmed meeting in UTC with escaped text and a stable event identity', () => {
  const text = outingCalendarFile(outing, venue);
  expect(text).toContain('DTSTART:20261102T183000Z\r\nDTEND:20261102T210000Z');
  expect(text).toContain(`UID:${outing.id}@onyva`);
  expect(text).toContain('Café\\, Étoile\\; Paris\\nÉtage');
  expect(text).not.toContain(outing.inviteCode);
  expect(calendarEvent(outing, venue).startDate.getTime()).toBe(Date.parse(outing.startsAt));
});
it('rejects an unconfirmed venue', () => {
  expect(() => calendarEvent({ ...outing, confirmedVenueId: null }, venue)).toThrow();
});
it('folds long accented lines at 75 UTF-8 octets without breaking Unicode', () => {
  const text = outingCalendarFile(outing, { ...venue, name: 'É'.repeat(120) });
  for (const line of text.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  expect(text.replaceAll('\r\n ', '')).toContain(`SUMMARY:Onyva · ${'É'.repeat(120)}`);
});
