/**
 * QUOI     — un cercle sur la Terre (centre, rayon en km) en polygone GeoJSON, pour MapLibre.
 * POURQUOI — la zone d'une culture est faite de cercles (spec énigmes) ; MapLibre ne dessine pas de
 *            cercle géographique, seulement des polygones. Même approximation que le réveil côté SQL
 *            (1° de latitude = 111,32 km).
 */
export type Cercle = { lat: number; lng: number; rayon_km: number }

export function cercleEnPolygone(c: Cercle, cotes = 64) {
  const points: [number, number][] = []
  for (let i = 0; i <= cotes; i++) {
    const angle = (i / cotes) * 2 * Math.PI
    const lat = c.lat + (c.rayon_km * Math.cos(angle)) / 111.32
    const lng = c.lng + (c.rayon_km * Math.sin(angle)) / (111.32 * Math.cos((c.lat * Math.PI) / 180))
    points.push([lng, lat])
  }
  return { type: 'Polygon' as const, coordinates: [points] }
}
