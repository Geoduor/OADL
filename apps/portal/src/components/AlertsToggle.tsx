import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import {
  pushSupport,
  readEnvironment,
  subscriptionBody,
  urlBase64ToBytes,
  type PushSupport,
} from '../lib/push.js';

type State =
  | { kind: 'loading' }
  | { kind: 'unsupported' }
  | { kind: 'needs-install' }
  | { kind: 'blocked' }
  | { kind: 'server-off' }
  | { kind: 'off' }
  | { kind: 'on' };

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

async function sendToServer(subscription: PushSubscription): Promise<void> {
  const body = subscriptionBody(subscription.toJSON());
  if (!body) {
    throw new Error('This phone did not give a usable alert address.');
  }
  await api('/push/subscribe', { method: 'POST', body });
}

// Phone alerts: the person turns them on with a tap (browsers and iOS only
// allow the permission prompt after a tap). The alert text comes from the
// server and is shown by the service worker as plain text.
export function AlertsToggle() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const support: PushSupport = pushSupport(readEnvironment());
    if (support !== 'ok') {
      setState({ kind: support });
      return;
    }
    try {
      await navigator.serviceWorker.register('/sw.js');
      if (Notification.permission === 'denied') {
        setState({ kind: 'blocked' });
        return;
      }
      const subscription = await currentSubscription();
      if (subscription && Notification.permission === 'granted') {
        // Tell the server again: it is a no-op when nothing changed, and it
        // heals a device the browser quietly re-subscribed.
        await sendToServer(subscription);
        setState({ kind: 'on' });
        return;
      }
      setState({ kind: 'off' });
    } catch {
      setState({ kind: 'unsupported' });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function turnOn() {
    setBusy(true);
    setError(null);
    try {
      const key = await api<{ enabled: boolean; publicKey: string | null }>(
        '/push/public-key',
      );
      if (!key.enabled || !key.publicKey) {
        setState({ kind: 'server-off' });
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState({ kind: permission === 'denied' ? 'blocked' : 'off' });
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToBytes(key.publicKey),
        }));
      await sendToServer(subscription);
      setState({ kind: 'on' });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Could not turn alerts on',
      );
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setError(null);
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        const { endpoint } = subscription;
        await api('/push/unsubscribe', { method: 'POST', body: { endpoint } });
        await subscription.unsubscribe();
      }
      setState({ kind: 'off' });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Could not turn alerts off',
      );
    } finally {
      setBusy(false);
    }
  }

  if (state.kind === 'loading') return null;

  return (
    <div className="item">
      <h2>Phone alerts</h2>
      {state.kind === 'unsupported' && (
        <p className="muted">
          This browser cannot show phone alerts. Alerts still appear here.
        </p>
      )}
      {state.kind === 'needs-install' && (
        <p className="muted">
          On iPhone, first add this app to your Home Screen (Share, then Add to
          Home Screen), open it from there, and come back to this page.
        </p>
      )}
      {state.kind === 'blocked' && (
        <p className="muted">
          Alerts are blocked for this app. Allow notifications for it in your
          phone or browser settings, then reload.
        </p>
      )}
      {state.kind === 'server-off' && (
        <p className="muted">Phone alerts are not set up on the server yet.</p>
      )}
      {state.kind === 'off' && (
        <>
          <p className="muted">
            Get an alert on this phone for new orders, even when the app is
            closed.
          </p>
          <button type="button" disabled={busy} onClick={() => void turnOn()}>
            Turn on phone alerts
          </button>
        </>
      )}
      {state.kind === 'on' && (
        <>
          <p className="muted">Phone alerts are on for this device.</p>
          <button type="button" disabled={busy} onClick={() => void turnOff()}>
            Turn off phone alerts
          </button>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
