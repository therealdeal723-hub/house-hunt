/* eslint-disable no-undef */
// Injected manifest placeholder (required by vite-plugin-pwa injectManifest)
import { precacheAndRoute } from 'workbox-precaching';
try { precacheAndRoute(self.__WB_MANIFEST || []); } catch { /* ignore */ }

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { title: 'House Hunt', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'House Hunt';
  const options = {
    body: data.body || '',
    tag: data.tag,
    icon: '/house-hunt/icons/icon-192.png',
    badge: '/house-hunt/icons/icon-192.png',
    data: { url: data.url || '/house-hunt/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/house-hunt/';
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      if (client.url.includes('/house-hunt/') && 'focus' in client) {
        client.navigate?.(target);
        return client.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  })());
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
