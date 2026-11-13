import type { Outing } from '@onyva/shared';

export type OutingStatus = { key: 'confirmed' | 'chosen' | 'waiting'; label: string; detail: string };

/** One status, always written in words: color only supports it. A venue picked by hand is never called the most balanced. */
export function outingStatus(outing: Outing): OutingStatus {
  if (outing.confirmedVenueId) return { key: 'confirmed', label: 'Confirmée', detail: 'Le lieu est confirmé.' };
  if (outing.selectedVenue) return { key: 'chosen', label: 'Lieu choisi', detail: `${outing.selectedVenue.name}, trajets en vérification.` };
  return { key: 'waiting', label: 'En attente', detail: outing.participants.length < 2 ? 'On attend les autres départs.' : 'Le lieu reste à choisir.' };
}
