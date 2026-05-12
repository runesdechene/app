/// <reference lib="webworker" />
/// <reference types="vite-plugin-pwa/client" />

// Service Worker custom — Runes de Chêne PWA
// - Précache via injectManifest (workbox)
// - SPA navigation fallback (sauf /lieu/* et /sitemap*)
// - Push notifications (showNotification + click → focus tab)
// Spec : docs/superpowers/specs/2026-05-09-push-notifications-design.md

import { precacheAndRoute, cleanupOutdatedCaches, matchPrecache } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope

// Précaching généré au build
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// SPA navigation fallback (sauf SEO pages et sitemap qui sont en redirect Netlify)
const denylist: RegExp[] = [/^\/lieu\//, /^\/sitemap/]

// IMPORTANT : matchPrecache résout dynamiquement le nom de cache workbox
// (workbox-precache-v2-<scope>). Avant : caches.open('workbox-precache-v2')
// créait un cache vide, fallback fetch systématique → TypeError "Load failed"
// dès un blip réseau (iOS+Android, intermittent). Bug introduit V0.7.7,
// révélé par le switch domaine carte→app (mai 2026).
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

// Dernier recours : ne JAMAIS laisser respondWith() rejeter (sinon le navigateur
// remonte "Fetch event respond with received an error: TypeError: Load failed").
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
