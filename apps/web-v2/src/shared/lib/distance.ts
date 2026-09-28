/**
 * QUOI     — la distance à vol d'oiseau entre deux points, et son écriture (« 170 km »).
 * POURQUOI — les cartes de lieux du profil disent à quelle distance est chaque lieu de
 *            l'Explorateur qui regarde (« une fonction très utilisée », Uriel, 27/09).
 *            Formule de haversine : assez juste pour des distances de randonnée.
 */
export type Point = { latitude: number; longitude: number }

const RAYON_TERRE_KM = 6371

function radians(degres: number): number {
  return (degres * Math.PI) / 180
}

export function distanceKm(a: Point, b: Point): number {
  const dLat = radians(b.latitude - a.latitude)
  const dLon = radians(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2
  return 2 * RAYON_TERRE_KM * Math.asin(Math.sqrt(h))
}

export function formatDistance(km: number): string {
  return km < 1 ? 'moins d’1 km' : `${String(Math.round(km))} km`
}
