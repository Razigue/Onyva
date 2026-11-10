// Wall-clock helpers in the Paris time zone, whatever the time zone of the phone.
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

/** Paris calendar day of today, tomorrow and the coming Saturday (next week's when today is Saturday). */
export function quickDays(now = new Date()) {
  const shift = (days: number) => parisParts(new Date(now.getTime() + days * 86400_000)).day;
  return [
    { label: 'Aujourd’hui', day: shift(0) },
    { label: 'Demain', day: shift(1) },
    { label: 'Ce week-end', day: shift((6 - now.getDay() + 7) % 7 || 7) },
  ];
}
