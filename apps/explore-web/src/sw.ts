/// <reference lib="webworker" />
/// <reference types="vite-plugin-pwa/client" />

// Service Worker custom — Runes de Chêne PWA
// - Précache via injectManifest (workbox)
// - SPA navigation fallback (sauf /lieu/* et /sitemap*)
// - Push notifications (showNotification + click → focus tab)
// - Kill-switch quand servi depuis l'origin legacy carte.runesdechene.com
// - Handler message KILL_SWITCH pour UpdateBanner.forceUpdate
// Spec push : docs/superpowers/specs/2026-05-09-push-notifications-design.md

import { precacheAndRoute, cleanupOutdatedCaches, matchPrecache } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope

// Les browsers ne suivent pas les redirects cross-origin pour /sw.js
// → les SW installés à carte.* ne peuvent pas s'updater via le 301 normal.
// Une exception netlify.toml sert /sw.js en 200 sur carte.*, on détecte
// l'origin ici et on active un mode kill-switch propre : unregister
// + clear caches + navigate les clients vers app.runesdechene.com.
const IS_LEGACY_ORIGIN = self.location.hostname === 'carte.runesdechene.com'

if (IS_LEGACY_ORIGIN) {
  self.addEventListener('install', () => {
    self.skipWaiting()
  })

  self.addEventListener('activate', (event: ExtendableEvent) => {
    event.waitUntil((async () => {
      try {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      } catch {
        // ignore
      }
      try {
        await self.registration.unregister()
      } catch {
        // ignore
      }
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of allClients) {
        try {
          await (client as WindowClient).navigate('https://app.runesdechene.com/')
        } catch {
          // ignore
        }
      }
    })())
  })
} else {
  cleanupOutdatedCaches()
  precacheAndRoute(self.__WB_MANIFEST)

  // SPA navigation fallback (sauf SEO pages et sitemap)
  const denylist: RegExp[] = [/^\/lieu\//, /^\/sitemap/]

  // matchPrecache résout dynamiquement le nom de cache workbox
  // (workbox-precache-v2-<scope>). caches.open('workbox-precache-v2')
  // créait un cache vide, fallback fetch systématique → TypeError
  // "Load failed" dès un blip réseau. Fix V0.8.14.
  registerRoute(
    new NavigationRoute(
      async ({ event }) => {
        const fetchEvent = event as FetchEvent
        const url = new URL(fetchEvent.request.url)
        if (denylist.some((re) => re.test(url.pathname))) {
          try {
            return await fetch(fetchEvent.request)
          } catch {
            return offlineFallback()
          }
        }
        try {
          const cached = await matchPrecache('/index.html')
          if (cached) return cached
        } catch {
          // précache pas prêt → on tente le réseau
        }
        try {
          return await fetch(fetchEvent.request)
        } catch {
          return offlineFallback()
        }
      },
    ),
  )

  // === Push notifications ===

  interface PushPayload {
    title: string
    body: string
    url: string
  }

  function normalizeAppUrl(raw: string): string {
    if (raw.startsWith('/carte') || raw.startsWith('/accueil')) return raw
    const queryIdx = raw.indexOf('?')
    const query = queryIdx >= 0 ? raw.slice(queryIdx) : ''
    return '/carte' + query
  }

  self.addEventListener('push', (event: PushEvent) => {
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

  // KILL_SWITCH demandé par UpdateBanner.forceUpdate. unregister() côté
  // client laisse le SW contrôleur jusqu'à fermeture de toutes les pages.
  // Le SW se désinscrit depuis l'intérieur — seule garantie que le reload
  // qui suit ne sera plus intercepté.
  self.addEventListener('message', (event: ExtendableMessageEvent) => {
    const data = event.data as { type?: string } | null
    if (data?.type !== 'KILL_SWITCH') return
    event.waitUntil((async () => {
      try {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      } catch {
        // ignore
      }
      try {
        await self.registration.unregister()
      } catch {
        // ignore
      }
    })())
  })
}

function offlineFallback(): Response {
  return new Response(
    '<!doctype html><meta charset=utf-8><title>Runes de Chêne</title>' +
      '<body style="font-family:system-ui;padding:2rem;text-align:center;background:#f8f3e7;color:#5a4632">' +
      '<h1 style="margin-top:3rem">Réseau perdu</h1>' +
      '<p>Recharge la page quand la connexion revient.</p>' +
      '</body>',
    { headers: { 'content-type': 'text/html; charset=utf-8' }, status: 503 },
  )
}
