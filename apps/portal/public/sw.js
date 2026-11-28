// Service worker for phone alerts (Web Push). Plain JavaScript on purpose: it
// is served as-is from /sw.js and is not bundled. It shows what the server
// sends and opens the right page on tap. Alerts carry the order number and
// county only (never customer details). Text is passed to showNotification as
// plain text, so nothing here is ever treated as HTML.

// Only same-site paths are opened: never an address the push message names.
function safePath(value) {
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//')
    ? value
    : '/notifications';
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title =
    typeof data.title === 'string' && data.title ? data.title : 'OADL';
  const body = typeof data.body === 'string' ? data.body : '';
  // Browsers that require every push to show something (userVisibleOnly)
  // would punish a silent one, so this always shows.
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { path: safePath(data.url) },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(
    safePath(event.notification.data && event.notification.data.path),
    self.location.origin,
  ).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windows) => {
        for (const client of windows) {
          if (
            client.url.startsWith(self.location.origin) &&
            'focus' in client
          ) {
            return client.focus().then(() => client.navigate(target));
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});
