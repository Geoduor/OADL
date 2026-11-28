// Web Push needs a VAPID key pair and a contact subject (RFC 8292). Generate
// once with `pnpm exec web-push generate-vapid-keys` and keep the private key
// secret. When any value is missing, push is switched off and the rest of the
// app works as before (in-app notifications are unaffected).
// Source: https://github.com/web-push-libs/web-push (README, VAPID section).
export interface PushConfig {
  publicKey: string;
  privateKey: string;
  // https: or mailto: URI. Avoid localhost: Apple Push may reject it.
  subject: string;
}

export function pushConfig(
  env: NodeJS.ProcessEnv = process.env,
): PushConfig | null {
  const publicKey = env['VAPID_PUBLIC_KEY']?.trim();
  const privateKey = env['VAPID_PRIVATE_KEY']?.trim();
  const subject = env['VAPID_SUBJECT']?.trim();
  if (!publicKey || !privateKey || !subject) {
    return null;
  }
  return { publicKey, privateKey, subject };
}
