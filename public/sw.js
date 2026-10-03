self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = { title: 'Portaria Virtual', body: 'Você tem um pedido de visita.', url: '/' };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    // payload padrão
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: { url: payload.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url;
  if (!url) {
    return;
  }
  event.waitUntil(self.clients.openWindow(url));
});
