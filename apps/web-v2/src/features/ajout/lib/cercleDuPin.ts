/**
 * QUOI     — le cercle de 200 m d'un pin, sur la carte de l'étape « Où » : un voile et un contour
 *            pointillé ; sur le satellite, un trait crème bordé d'un liseré d'encre.
 * POURQUOI — spec pin GPS : le cercle dit où le lieu reste « sur place ». À l'encre seule, il
 *            disparaissait sur l'imagerie (06/10 : un trait brun de 2 px, un voile à 7 %, sur des
 *            forêts presque de la même couleur). Clair bordé de sombre : lisible sur la forêt comme
 *            sur les champs, comme les routes d'une carte satellite.
 * ATTENTION — idempotent : appelé à chaque « style.load » et à chaque « styledata » (un style neuf
 *            repart sans le cercle), il ne pose que ce qui manque.
 */
import type { AddLayerObject, SourceSpecification } from 'maplibre-gl'
import { cercle } from '@/shared/lib/cercle'
import type { CouleursCarte } from '@/shared/lib/couleursCarte'
import type { Point } from '@/shared/lib/distance'
import { estSatellite } from '@/shared/lib/styleSatellite'

const SOURCE = 'cercle-du-pin'
const RAYON_KM = 0.2 // le rayon de la visite en V2 (visiter_lieu)

// Ce que le cercle demande à la carte, et rien de plus.
type CarteDuCercle = {
  getSource: (id: string) => unknown
  getLayer: (id: string) => unknown
  addSource: (id: string, source: SourceSpecification) => unknown
  addLayer: (calque: AddLayerObject) => unknown
}

export function poserCercleDuPin(carte: CarteDuCercle, pin: Point, c: CouleursCarte) {
  if (carte.getLayer(`${SOURCE}-contour`)) return
  if (!carte.getSource(SOURCE)) {
    const contour = cercle(pin.latitude, pin.longitude, RAYON_KM)
    carte.addSource(SOURCE, {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [contour] } },
    })
  }
  const satellite = estSatellite(carte)
  carte.addLayer({
    id: `${SOURCE}-voile`,
    type: 'fill',
    source: SOURCE,
    paint: satellite
      ? { 'fill-color': c.halo, 'fill-opacity': 0.15 }
      : { 'fill-color': c.encre, 'fill-opacity': 0.07 },
  })
  if (satellite) {
    carte.addLayer({
      id: `${SOURCE}-lisere`,
      type: 'line',
      source: SOURCE,
      paint: { 'line-color': c.encre, 'line-width': 5, 'line-opacity': 0.6 },
    })
  }
  carte.addLayer({
    id: `${SOURCE}-contour`,
    type: 'line',
    source: SOURCE,
    paint: {
      'line-color': satellite ? c.halo : c.encre,
      'line-width': satellite ? 2.5 : 2,
      'line-dasharray': [3, 2],
    },
  })
}
