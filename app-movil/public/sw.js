/* JAC Seguros App — trabajador de servicio SOLO para notificaciones.
   No guarda copias de nada (sin cache): los datos siempre vienen de la base. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  const titulo = String(d.title || 'JAC Seguros').slice(0, 120);
  e.waitUntil(self.registration.showNotification(titulo, {
    body: String(d.body || '').slice(0, 400),
    tag: d.tag ? String(d.tag).slice(0, 80) : undefined,
    icon: './logo-192.png',
    badge: './logo-192.png',
    data: { url: './' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const lista = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of lista) { if ('focus' in c) return c.focus(); }
    if (self.clients.openWindow) return self.clients.openWindow(self.registration.scope);
  })());
});
