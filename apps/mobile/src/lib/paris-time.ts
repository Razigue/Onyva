// Wall-clock helpers in the Paris time zone, whatever the time zone of the phone.
// Pure functions: no React Native import, covered by Vitest.

export function parisParts(date: Date) {
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date).split(' ');
  return { day: parts[0]!, time: parts[1]! };
}

/** Resolves an explicit Paris wall time; rejects nonexistent DST times instead of silently moving them. */
export function parisDate(day: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const utc = Date.parse(`${day}T${time}:00Z`);
  for (const offset of [2, 1]) {
    const date = new Date(utc - offset * 3600_000);
    if (!Number.isFinite(date.getTime())) continue;
    const parts = parisParts(date);
    if (parts.day === day && parts.time === time) return date;
  }
  return null;
}

const addDays = (day: string, days: number) => new Date(Date.parse(`${day}T12:00:00Z`) + days * 86400_000).toISOString().slice(0, 10);
const weekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

/** Tonight, tomorrow and the coming Saturday (next week's when today is Saturday), as Paris calendar days. */
export function quickDays(now = new Date()) {
  const today = parisParts(now).day;
  return [
    { label: 'Ce soir', day: today },
    { label: 'Demain', day: addDays(today, 1) },
    { label: 'Ce week-end', day: addDays(today, (6 - weekday(today) + 7) % 7 || 7) },
  ];
}

/** "20 h" or "20 h 30". */
export function formatSlot(time: string): string {
  const [hours, minutes] = time.split(':');
  return minutes === '00' ? `${Number(hours)} h` : `${Number(hours)} h ${minutes}`;
}

/** "jeudi 26 novembre". */
export function formatDay(day: string): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${day}T12:00:00Z`));
}

const EVENING = ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'];
const LATE = ['21:30', '22:00', '22:30', '23:00', '23:30'];
const LEAD_MS = 3600_000;

/**
 * Round evening slots to tap, at least one hour ahead (the product default). Late slots fill in when the
 * evening is almost over. The selected time always stays visible, even when it is not a round slot.
 */
export function timeSlots(day: string, selected: string | null, now = new Date()): string[] {
  const upcoming = (time: string) => { const date = parisDate(day, time); return !!date && date.getTime() >= now.getTime() + LEAD_MS; };
  let slots = EVENING.filter(upcoming);
  if (slots.length < 3) slots = [...slots, ...LATE.filter(upcoming)].slice(0, 5);
  if (selected && !slots.includes(selected)) slots.push(selected);
  return slots.sort();
}

/** First slot still valid for this day, or null when the day is over. */
export function firstSlot(day: string, now = new Date()): string | null {
  return timeSlots(day, null, now)[0] ?? null;
}

/** "Ce soir, 20 h", "Demain, 19 h 30" or "jeudi 26 novembre, 20 h", for an instant in Paris. */
export function formatWhen(instant: string | Date, now = new Date()): string {
  const { day, time } = parisParts(new Date(instant)), today = parisParts(now).day;
  const label = day === today ? (time >= '17:00' ? 'Ce soir' : 'Aujourd’hui') : day === addDays(today, 1) ? 'Demain' : formatDay(day);
  return `${label}, ${formatSlot(time)}`;
}
