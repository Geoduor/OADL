import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// In development the browser talks only to this dev server, and /api is
// forwarded to the Nest API (http://localhost:3000). The portal then looks
// same-origin to the browser, so the session cookie and the API's CSRF check
// work without extra settings. In production the portal calls the API on its
// own subdomain through VITE_API_URL (D30, Q31), and the API's CORS_ORIGINS
// must list the portal's origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
