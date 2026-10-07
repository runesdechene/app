// QUOI     — l'ancien service worker de /v2/ (la V2 avant la bascule du 07/10/2026) se retire :
//            il vide ses caches, se désinscrit, et ses pages ouvertes se rechargent — Netlify les
//            mène alors à la racine, où l'appli vit désormais.
// POURQUOI — un navigateur qui a essayé la V2 garde une inscription de portée /v2/ ; sans ce
//            fichier, elle resterait orpheline et servirait la V2 en cache (constaté le 07/10).
//            Même méthode que pour carte.runesdechene.com (CHANGELOG de la V1).
// ATTENTION — servi tel quel à /v2/sw.js (netlify.toml : la règle /v2/* n'est pas forcée), hors
//            du précache (vite.config.ts : globIgnores).
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const cle of await caches.keys()) await caches.delete(cle)
      await self.registration.unregister()
      for (const fenetre of await self.clients.matchAll({ type: 'window' })) {
        fenetre.navigate(fenetre.url)
      }
    })(),
  )
})
