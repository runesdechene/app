/**
 * QUOI     — un cercle de la carte (centre, rayon en km) et son approximation par un polygone de 64 points.
 * POURQUOI — MapLibre dessine des polygones, pas des cercles en kilomètres : on les approche à la main
 *            (1° de latitude = 111,32 km ; la longitude se resserre avec la latitude).
 */
import type { Cercle } from '@/shared/cultures/api'

const POINTS = 64
export const KM_PAR_DEGRE = 111.32

// Anneau fermé de positions [lng, lat], prêt pour un Polygon GeoJSON.
export function cercleEnPolygone(c: Cercle): [number, number][] {
  const anneau: [number, number][] = []
  for (let i = 0; i < POINTS; i++) {
    const angle = (2 * Math.PI * i) / POINTS
    anneau.push([
      c.lng + ((c.rayon_km / KM_PAR_DEGRE) * Math.cos(angle)) / Math.cos((c.lat * Math.PI) / 180),
      c.lat + (c.rayon_km / KM_PAR_DEGRE) * Math.sin(angle),
    ])
  }
  const [premier] = anneau
  return premier ? [...anneau, premier] : anneau
}
