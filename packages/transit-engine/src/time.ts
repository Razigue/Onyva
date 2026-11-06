// Service days follow the GTFS definition: times count from "noon minus 12 h" in the feed time zone.
export const TIME_ZONE = 'Europe/Paris';
const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function parts(epoch: number) {
  const values: Record<string, number> = {};
  for (const part of formatter.formatToParts(new Date(epoch * 1000))) {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  }
  return values as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Offset of Paris local time from UTC, in seconds, at a given instant. */
export function parisOffset(epoch: number): number {
  const p = parts(epoch);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) / 1000 - Math.floor(epoch);
}

/** Days since 1970-01-01 of the Paris calendar date at this instant. */
export function parisDay(epoch: number): number {
  const p = parts(epoch);
  return Date.UTC(p.year, p.month - 1, p.day) / 86_400_000;
}

/** GTFS date YYYYMMDD to a day number. */
export function gtfsDateToDay(value: string): number {
  if (!/^\d{8}$/.test(value)) throw new Error(`Invalid GTFS date: ${value}`);
  return Date.UTC(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, Number(value.slice(6, 8))) / 86_400_000;
}

export function dayToIsoDate(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

/** Epoch of "noon minus 12 h" in Paris for a service day. Differs from midnight on DST change days. */
export function serviceDayStart(day: number): number {
  const noonGuess = day * 86_400 + 12 * 3600;
  const noon = noonGuess - parisOffset(noonGuess - parisOffset(noonGuess));
  return noon - 12 * 3600;
}

/** GTFS time HH:MM:SS, possibly beyond 24:00, to seconds. Empty value gives null. */
export function parseGtfsTime(value: string): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) throw new Error(`Invalid GTFS time: ${value}`);
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}
