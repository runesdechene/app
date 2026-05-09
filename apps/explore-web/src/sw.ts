/// <reference lib="webworker" />
/// <reference types="vite-plugin-pwa/client" />

// Service Worker custom — Runes de Chêne PWA
// - Précache via injectManifest (workbox)
// - SPA navigation fallback (sauf /lieu/* et /sitemap*)
// - Push notifications (showNotification + click → focus tab)
// Spec : docs/superpowers/specs/2026-05-09-push-notifications-design.md

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope

// Précaching généré au build
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// SPA navigation fallback (sauf SEO pages et sitemap qui sont en redirect Netlify)
const denylist: RegExp[] = [/^\/lieu\//, /^\/sitemap/]

registerRoute(
  new NavigationRoute(
    async ({ event }) => {
      const fetchEvent = event as FetchEvent
      const url = new URL(fetchEvent.request.url)
      if (denylist.some((re) => re.test(url.pathname))) {
        return fetch(fetchEvent.request)
      }
      const cache = await caches.open('workbox-precache-v2')
      const match = await cache.match('/index.html')
      return match ?? fetch(fetchEvent.request)
    },
  ),
)

// === Push notifications ===

interface PushPayload {
  title: string
  body: string
  url: string
}

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return
  let payload: PushPayload
  try {
    payload = event.data.json() as PushPayload
  } catch {
    return
  }
  const { title, body, url } = payload
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:  '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data:  { url },
      tag:   url,
    }),
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const targetUrl = (event.notification.data as { url?: string })?.url ?? '/'
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of allClients) {
      const url = new URL(client.url)
      if (url.origin === self.location.origin) {
        await (client as WindowClient).focus()
        await (client as WindowClient).navigate(targetUrl)
        return
      }
    }
    await self.clients.openWindow(targetUrl)
  })())
})

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(self.clients.claim())
})
