// Money is whole Kenyan shillings (AGENTS.md section 5).
export function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE')}`;
}

// Timestamps are stored in UTC and shown in Kenya (AGENTS.md section 5).
// Built from parts so the text does not change between browsers or ICU
// versions.
export function formatNairobi(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('day')} ${part('month')} ${part('year')}, ${part('hour')}:${part('minute')}`;
}
