import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../app/auth.js';
import { api } from '../lib/api.js';
import { formatNairobi } from '../lib/format.js';
import {
  announceNotificationsChanged,
  NOTIFICATIONS_CHANGED,
  orderPathFor,
  POLL_MS,
} from '../lib/notifications.js';
import type { NotificationRow } from '../lib/types.js';

// Both roles: my notifications, newest first. The server returns only mine.
export function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<NotificationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (document.visibilityState === 'hidden') {
      return;
    }
    api<NotificationRow[]>('/notifications')
      .then((result) => {
        setRows(result);
        setError(null);
      })
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : 'Could not load'),
      );
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, POLL_MS);
    window.addEventListener(NOTIFICATIONS_CHANGED, load);
    document.addEventListener('visibilitychange', load);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_CHANGED, load);
      document.removeEventListener('visibilitychange', load);
    };
  }, [load]);

  async function open(row: NotificationRow) {
    if (!row.readAt) {
      try {
        await api(`/notifications/${row.id}/read`, { method: 'POST' });
        announceNotificationsChanged();
      } catch {
        // Opening the order matters more than the read mark.
      }
    }
    const path = user ? orderPathFor(user.role, row) : null;
    if (path) {
      void navigate(path);
    }
  }

  async function markAllRead() {
    try {
      await api('/notifications/read-all', { method: 'POST' });
      announceNotificationsChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update');
    }
  }

  const unread = rows?.filter((row) => !row.readAt).length ?? 0;

  return (
    <section>
      <div className="row">
        <h1>Notifications</h1>
        {unread > 0 && (
          <button
            type="button"
            className="secondary"
            onClick={() => void markAllRead()}
          >
            Mark all as read
          </button>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!rows && !error && <p className="status">Loading…</p>}
      {rows?.length === 0 && <p className="muted">Nothing yet.</p>}
      <ul className="list">
        {rows?.map((row) => {
          const clickable =
            !row.readAt || orderPathFor(user?.role ?? 'AGENT', row);
          return (
            <li key={row.id}>
              <button
                type="button"
                className={`item block notification${row.readAt ? '' : ' unread'}`}
                disabled={!clickable}
                onClick={() => void open(row)}
              >
                <div className="row">
                  <strong>{row.title}</strong>
                  <span className="muted">{formatNairobi(row.createdAt)}</span>
                </div>
                <div>{row.body}</div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
