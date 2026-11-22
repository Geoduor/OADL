import 'dotenv/config';

// CORS_ORIGINS: the portal origins allowed to call the API with cookies, as a
// comma-separated list of origins (scheme://host[:port], no path), for example
// https://app.example.com. Empty means none.
export function allowedOrigins(): string[] {
  return (process.env['CORS_ORIGINS'] ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
