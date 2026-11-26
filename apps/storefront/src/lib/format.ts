// Money is whole shillings (integer KES).
export function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE')}`;
}
