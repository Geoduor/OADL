// Order numbers follow the proposal in docs/DATA_MODEL.md: OADL-YYMMDD-####.
// The date is the Africa/Nairobi calendar date. The last four digits are
// random; the database unique constraint catches the rare collision and the
// service retries with a new number.
// TODO(confirm): Q18 (what OADL stands for) and whether the client wants this
// format or a running sequence.
const nairobiDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Nairobi',
  year: '2-digit',
  month: '2-digit',
  day: '2-digit',
});

export function generateOrderNo(
  now: Date = new Date(),
  random: () => number = Math.random,
): string {
  const parts = Object.fromEntries(
    nairobiDate.formatToParts(now).map((part) => [part.type, part.value]),
  );
  const suffix = String(Math.floor(random() * 10_000)).padStart(4, '0');
  return `OADL-${parts['year']}${parts['month']}${parts['day']}-${suffix}`;
}
