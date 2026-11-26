import type { NextConfig } from 'next';

// TODO(confirm): add a Content-Security-Policy before go-live. It must allow
// Cloudflare Turnstile (challenges.cloudflare.com) and the API origin.
const config: NextConfig = {
  poweredByHeader: false,
};

export default config;
