import { describe, expect, it } from 'vitest';
import type { Outing } from '@onyva/shared';
import { outingStatus } from './outing-status';

const base = { participants: [{ id: 'a' }], confirmedVenueId: null, selectedVenue: null } as unknown as Outing;

describe('outing status on the home screen', () => {
  it('waits for friends, then for a venue', () => {
    expect(outingStatus(base)).toMatchObject({ key: 'waiting', detail: 'On attend les autres départs.' });
    expect(outingStatus({ ...base, participants: [{ id: 'a' }, { id: 'b' }] } as unknown as Outing).detail).toBe('Le lieu reste à choisir.');
  });
  it('names a venue picked by hand without calling it the most balanced', () => {
    const status = outingStatus({ ...base, selectedVenue: { name: 'Café du rendez-vous' } } as unknown as Outing);
    expect(status).toMatchObject({ key: 'chosen', label: 'Lieu choisi' });
    expect(JSON.stringify(status)).not.toMatch(/équilibré/);
  });
  it('shows a confirmed outing', () => {
    expect(outingStatus({ ...base, confirmedVenueId: 'v1' } as unknown as Outing).key).toBe('confirmed');
  });
});
