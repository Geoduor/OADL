// Kenya is UTC+03:00 all year (no daylight saving), so a Nairobi calendar day
// always starts at 00:00 +03:00 (AGENTS.md section 5: store UTC, show Nairobi).

// The instant a Nairobi calendar day (YYYY-MM-DD) starts.
export function nairobiDayStart(date: string): Date {
  return new Date(`${date}T00:00:00+03:00`);
}

// Today's calendar date in Kenya as YYYY-MM-DD (en-CA prints that form).
export function nairobiToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
