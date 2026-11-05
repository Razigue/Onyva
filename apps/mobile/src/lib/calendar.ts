import * as Calendar from 'expo-calendar';
import type { Outing, Venue } from '@onyva/shared';
import { calendarEvent } from '@onyva/shared/calendar';

export async function addToCalendar(outing: Outing, venue: Venue): Promise<void> {
  // The system editor lets the user save without granting calendar read access.
  await Calendar.createEventInCalendarAsync(calendarEvent(outing, venue));
}
