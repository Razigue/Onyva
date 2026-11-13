import { describe, expect, it } from 'vitest';
import { firstSlot, formatDay, formatSlot, formatWhen, parisDate, quickDays, timeSlots } from './paris-time';

const at = (iso: string) => new Date(iso);

describe('quick days', () => {
  it('gives tonight, tomorrow and the coming Saturday in Paris time', () => {
    // 22:30 UTC is 23:30 in Paris, still Tuesday 10 November.
    expect(quickDays(at('2026-11-10T22:30:00Z')).map(d => d.day)).toEqual(['2026-11-10', '2026-11-11', '2026-11-14']);
    // Saturday: the week-end chip points to the next Saturday.
    expect(quickDays(at('2026-11-14T10:00:00Z'))[2]!.day).toBe('2026-11-21');
    // Just after midnight in Paris, still the previous day in UTC.
    expect(quickDays(at('2026-11-10T23:30:00Z'))[0]!.day).toBe('2026-11-11');
  });
});

describe('time slots', () => {
  it('offers round evening slots at least one hour ahead', () => {
    expect(timeSlots('2026-11-12', null, at('2026-11-10T09:00:00Z'))).toEqual(['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00']);
    // 18:40 in Paris: the first round slot at least one hour ahead is 20:00.
    expect(timeSlots('2026-11-10', null, at('2026-11-10T17:40:00Z'))).toEqual(['20:00', '20:30', '21:00']);
  });
  it('fills in late slots when the evening is almost over', () => {
    expect(timeSlots('2026-11-10', null, at('2026-11-10T19:10:00Z'))).toEqual(['21:30', '22:00', '22:30', '23:00', '23:30']);
    expect(firstSlot('2026-11-10', at('2026-11-10T22:40:00Z'))).toBeNull();
  });
  it('keeps a time picked with the selector visible', () => {
    expect(timeSlots('2026-11-12', '20:15', at('2026-11-10T09:00:00Z'))).toContain('20:15');
  });
  it('formats slots and days in French', () => {
    expect([formatSlot('20:00'), formatSlot('19:30')]).toEqual(['20 h', '19 h 30']);
    expect(formatDay('2026-11-26')).toBe('jeudi 26 novembre');
  });
  it('rejects a wall time that does not exist on the DST change', () => {
    expect(parisDate('2027-03-28', '02:30')).toBeNull();
    expect(parisDate('2026-11-12', '20:00')?.toISOString()).toBe('2026-11-12T19:00:00.000Z');
  });
});

describe('outing time on the home screen', () => {
  const now = at('2026-11-10T09:00:00Z');
  it('speaks like a person', () => {
    expect(formatWhen('2026-11-10T19:00:00Z', now)).toBe('Ce soir, 20 h');
    expect(formatWhen('2026-11-10T11:30:00Z', now)).toBe('Aujourd’hui, 12 h 30');
    expect(formatWhen('2026-11-11T18:30:00Z', now)).toBe('Demain, 19 h 30');
    expect(formatWhen('2026-11-26T19:00:00Z', now)).toBe('jeudi 26 novembre, 20 h');
  });
});
