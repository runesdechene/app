/**
 * QUOI     — MapLibre, réglé une fois pour toute l'app : la carte et l'ajout d'un lieu le prennent
 *            ici, jamais directement de 'maplibre-gl'.
 * POURQUOI — MapLibre 6 cherche son worker à côté de son propre fichier ; une fois empaqueté par
 *            Vite (dans assets/), il ne l'y trouve plus et la carte reste vide (02/10 : 1.0.21,
 *            retirée en trois minutes). Vite empaquette le worker à part (`?worker&url`) et
 *            MapLibre reçoit son adresse.
 */
import * as maplibregl from 'maplibre-gl'
import adresseDuWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

maplibregl.setWorkerUrl(adresseDuWorker)

export { maplibregl }
