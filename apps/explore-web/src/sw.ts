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

// Normalise toute URL push pour qu'elle pointe vers une route in-PWA
// (/carte ou /accueil). Sans ça, l'OS Android ouvre Chrome au lieu de la
// PWA installée. V0.7.11 (10/05) : /accueil ajouté pour permettre aux
// notifs expedition_message d'ouvrir la modale d'expé (montée sur HomePage).
function normalizeAppUrl(raw: string): string {
  if (raw.startsWith('/carte') || raw.startsWith('/accueil')) return raw
  const queryIdx = raw.indexOf('?')
  const query = queryIdx >= 0 ? raw.slice(queryIdx) : ''
  return '/carte' + query
}

self.addEventListener('push', (event: PushEvent) => {
  // Robuste : on tente .json() puis .text(), avec fallback titre/body neutre.
  // userVisibleOnly:true exige qu'on affiche TOUJOURS une notif visible —
  // si on quitte sans showNotification, le navigateur affiche un fallback vide.
  let payload: Partial<PushPayload> = {}
  let rawText = ''
  if (event.data) {
    try {
      payload = event.data.json() as Partial<PushPayload>
    } catch {
      try {
        rawText = event.data.text()
      } catch {
        // ignore
      }
    }
  }
  const title = payload.title || 'Runes de Chêne'
  const body  = payload.body  || rawText || 'Tu as une nouvelle notification.'
  const url   = normalizeAppUrl(payload.url || '/carte')
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
  const rawUrl = (event.notification.data as { url?: string })?.url ?? '/carte'
  const targetUrl = normalizeAppUrl(rawUrl)
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
