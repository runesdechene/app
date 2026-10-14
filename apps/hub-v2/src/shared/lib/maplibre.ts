/**
 * QUOI     — MapLibre, réglé une fois pour tout le Hub : la carte des cultures le prend ici,
 *            jamais directement de 'maplibre-gl'. Porte aussi le fond de carte.
 * POURQUOI — MapLibre 6 cherche son worker à côté de son propre fichier ; une fois empaqueté par
 *            Vite (dans assets/), il ne l'y trouve plus et la carte reste vide. Vite empaquette le
 *            worker à part (`?worker&url`) et MapLibre reçoit son adresse.
 */
import * as maplibregl from 'maplibre-gl'
import adresseDuWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

maplibregl.setWorkerUrl(adresseDuWorker)

// Le fond de l'ancien écran des cultures.
export const STYLE_DE_CARTE = 'https://tiles.openfreemap.org/styles/positron'

export { maplibregl }
