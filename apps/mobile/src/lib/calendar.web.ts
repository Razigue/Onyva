import type { Outing, Venue } from '@onyva/shared';
import { outingCalendarFile } from '@onyva/shared/calendar';

export async function addToCalendar(outing: Outing, venue: Venue): Promise<void> {
  const url = URL.createObjectURL(new Blob([outingCalendarFile(outing, venue)], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'onyva.ics';
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
