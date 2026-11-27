import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Turnstile } from '../components/Turnstile.js';
import { api, ApiError } from '../lib/api.js';
import { validateRegistration } from '../lib/registration.js';

const SITE_KEY =
  (import.meta.env['VITE_CAPTCHA_SITE_KEY'] as string | undefined) ?? '';

// Cloudflare's documented dummy token. It only passes against the API's test
// secret, so it can never work in production; the form refuses to send it
// there (see `available`).
const DEV_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

// Agents register themselves and wait for the manager's approval (D26).
export function RegisterPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [resetCount, setResetCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Production needs a real site key; development may use the dummy token.
  const available = SITE_KEY !== '' || import.meta.env.DEV;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const problem = validateRegistration({
      name,
      phone,
      password,
      confirmPassword,
    });
    if (problem) {
      setError(problem);
      return;
    }
    const turnstileToken = SITE_KEY ? token : DEV_TOKEN;
    if (!turnstileToken) {
      setError('Please wait for the security check to finish, then try again.');
      return;
    }
    setBusy(true);
    try {
      await api('/auth/register', {
        method: 'POST',
        body: { name: name.trim(), phone, password, turnstileToken },
      });
      setPassword('');
      setConfirmPassword('');
      setDone(true);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.status === 429
            ? 'Too many attempts. Please wait a minute and try again.'
            : caught.message
          : 'Could not reach the server. Check your connection and try again.',
      );
      // A Turnstile token works once, so ask for a new one.
      setResetCount((count) => count + 1);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className="login">
        <div className="card">
          <h1>Registration received</h1>
          <p>
            The manager must approve your account before you can sign in. You
            will be able to sign in with your phone number and password once
            that is done.
          </p>
          <Link to="/login">Back to sign in</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="login">
      <form className="card" onSubmit={(event) => void submit(event)}>
        <h1>Agent registration</h1>
        <p className="muted">
          Register with your name, phone number and a password. The manager
          approves new agents before they can sign in.
        </p>
        <label>
          Full name
          <input
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          Phone number
          <input
            type="tel"
            inputMode="tel"
            autoComplete="username"
            placeholder="07XX XXX XXX"
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </label>
        <label>
          Password (at least 10 characters)
          <input
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <label>
          Repeat password
          <input
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </label>
        {SITE_KEY && (
          <Turnstile
            siteKey={SITE_KEY}
            onToken={setToken}
            resetCount={resetCount}
          />
        )}
        {!available && (
          <p className="error" role="alert">
            Registration is not available right now. Please contact the manager.
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primary" disabled={busy || !available}>
          {busy ? 'Sending…' : 'Register'}
        </button>
        <p className="muted">
          Already approved? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </main>
  );
}
