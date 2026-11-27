import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { NOTIFICATIONS_CHANGED, POLL_MS } from '../lib/notifications.js';

// The unread count for the bell. Asks again every POLL_MS, when the tab comes
// back into view and when the user reads something. A failed call keeps the
// last count: the bell must never get in the way of the work.
export function useUnreadCount(enabled: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let active = true;
    const load = () => {
      if (document.visibilityState === 'hidden') {
        return;
      }
      api<{ count: number }>('/notifications/unread-count')
        .then((result) => {
          if (active) {
            setCount(result.count);
          }
        })
        .catch(() => {
          // Keep the last count.
        });
    };
    load();
    const timer = window.setInterval(load, POLL_MS);
    window.addEventListener(NOTIFICATIONS_CHANGED, load);
    document.addEventListener('visibilitychange', load);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_CHANGED, load);
      document.removeEventListener('visibilitychange', load);
    };
  }, [enabled]);

  return count;
}
