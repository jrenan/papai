// Retire the former speech exercise PWA and its offline assets.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => event.waitUntil((async () => {
  for (const key of await caches.keys()) {
    if (key.startsWith('fono-do-leo-')) await caches.delete(key);
  }
  await self.registration.unregister();
  const home = new URL('../', self.location.href);
  const modulePath = new URL('./', self.location.href).pathname;
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  await Promise.allSettled(windows.map((client) => {
    const url = new URL(client.url);
    if (url.origin === home.origin && url.pathname.startsWith(modulePath)) {
      return client.navigate(home.href);
    }
  }));
})()));
