import 'dotenv/config';

export function assertLocalDatabase(): void {
  const url = process.env.DATABASE_URL ?? '';
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
    throw new Error('Refusing to run database tests on a non-local database');
  }
}
