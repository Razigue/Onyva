import type { Outing, Venue } from './index';

export function calendarEvent(outing: Outing, venue: Venue) {
  if (outing.confirmedVenueId !== venue.id) throw new Error('Confirme le lieu avant de l’ajouter au calendrier.');
  return {
    title: `Onyva · ${venue.name}`,
    startDate: new Date(outing.startsAt), endDate: new Date(outing.endsAt),
    location: `${venue.name}, ${venue.neighborhood}`,
    notes: 'Retrouve ton trajet aller et retour dans Onyva. Vérifie les perturbations avant de partir.',
  };
}

const escapeText = (value: string) => value.replaceAll('\\', '\\\\').replace(/\r\n|\r|\n/g, '\\n').replaceAll(';', '\\;').replaceAll(',', '\\,');
const utc = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// RFC 5545 folds at 75 UTF-8 octets, including the continuation space.
function fold(line: string): string {
  const lines: string[] = [];
  let current = '', bytes = 0;
  for (const character of line) {
    const size = new TextEncoder().encode(character).length;
    if (bytes + size > 75) { lines.push(current); current = ' '; bytes = 1; }
    current += character; bytes += size;
  }
  lines.push(current);
  return lines.join('\r\n');
}
export function outingCalendarFile(outing: Outing, venue: Venue): string {
  const event = calendarEvent(outing, venue);
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Onyva//Sorties//FR', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:${outing.id}@onyva`, `DTSTAMP:${utc(new Date(outing.updatedAt))}`,
    `DTSTART:${utc(event.startDate)}`, `DTEND:${utc(event.endDate)}`,
    `SUMMARY:${escapeText(event.title)}`, `LOCATION:${escapeText(event.location)}`, `DESCRIPTION:${escapeText(event.notes)}`,
    'END:VEVENT', 'END:VCALENDAR', '',
  ].map(fold).join('\r\n');
}
