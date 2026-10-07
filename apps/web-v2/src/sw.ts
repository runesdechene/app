/// <reference lib="webworker" />
/**
 * QUOI     — le service worker de la V2 : le précache, le repli de navigation sur l'appli pour
 *            ses seuls écrans, et les notifications push (afficher, ouvrir le bon écran).
 * POURQUOI — à la bascule (spec 2026-10-07-v2-bascule §3), il prend la portée / et remplace celui
 *            de la V1 sur les téléphones, dans la même inscription : les abonnements push suivent.
 *            Avant, sous /v2/, il apprend déjà à recevoir les push.
 * ATTENTION — deux notions : la base de l'appli (BASE_URL, /v2/ puis /explore/) et la portée du
 *            service worker (/v2/ puis /). La liste blanche et les liens se jugent sur la base.
 *            skipWaiting + clientsClaim : une nouvelle version prend la main tout de suite (règle
 *            v2.md, piège du 02/10).
 */
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { cheminDansLAppli, ecransExplore } from './sw/ecrans'

declare const self: ServiceWorkerGlobalScope

const base = import.meta.env.BASE_URL

void self.skipWaiting()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Hors des écrans d'Explore (liste blanche), la route ne s'applique pas : le réseau répond.
registerRoute(
  new NavigationRoute(
    async ({ request }) => (await matchPrecache(`${base}index.html`)) ?? fetch(request),
    { allowlist: [ecransExplore(base)] },
  ),
)

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

type Push = { title?: string; body?: string; url?: string }

function lirePush(event: PushEvent): Push {
  try {
    return (event.data?.json() ?? {}) as Push
  } catch {
    return { body: event.data?.text() ?? '' }
  }
}

self.addEventListener('push', (event) => {
  const push = lirePush(event)
  const url = cheminDansLAppli(push.url ?? '/accueil', base)
  event.waitUntil(
    self.registration.showNotification(push.title ?? 'Runes de Chêne', {
      body: push.body ?? '',
      icon: `${base}icon-192.png`,
      badge: `${base}icon-192.png`,
      data: { url },
      tag: url,
    }),
  )
})

// Toucher la notification : l'appli déjà ouverte vient devant et va à l'écran ; sinon elle s'ouvre.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string } | null)?.url ?? base
  event.waitUntil(
    (async () => {
      const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const fenetre = fenetres.find((f) => new URL(f.url).origin === self.location.origin)
      if (fenetre) {
        await fenetre.focus()
        await fenetre.navigate(url)
        return
      }
      await self.clients.openWindow(url)
    })(),
  )
})
