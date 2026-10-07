/**
 * QUOI     — MapLibre, réglé une fois pour le Hub (l'écran Cultures le prend ici).
 * POURQUOI — MapLibre 6 cherche son worker à côté de son propre fichier ; empaqueté par Vite, il ne
 *            l'y trouve plus et la carte reste grise. Vite empaquette le worker à part
 *            (`?worker&url`) et MapLibre reçoit son adresse — comme apps/web-v2/src/shared/lib/maplibre.ts.
 */
import * as maplibregl from 'maplibre-gl'
import adresseDuWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

maplibregl.setWorkerUrl(adresseDuWorker)

export { maplibregl }
