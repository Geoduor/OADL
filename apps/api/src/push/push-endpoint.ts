// The server POSTs to whatever endpoint a browser gives it, so a signed-in
// user must not be able to aim it at an internal address. This accepts only
// https URLs on port 443 with a public-looking host name (no IP literal, no
// credentials, a dot in the name).
// TODO(confirm): replace with an allow-list of the real push services
// (Apple documents *.push.apple.com; the others are UNVERIFIED) once checked.
export function isAcceptablePushEndpoint(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;
  if (url.port !== '' && url.port !== '443') return false;
  const host = url.hostname;
  if (!host.includes('.')) return false;
  // IPv6 literals are bracketed; IPv4 literals are four numeric parts.
  if (host.startsWith('[') || /^\d+(\.\d+){3}$/.test(host)) return false;
  if (host === 'localhost' || host.endsWith('.localhost')) return false;
  if (host.endsWith('.local') || host.endsWith('.internal')) return false;
  return true;
}
