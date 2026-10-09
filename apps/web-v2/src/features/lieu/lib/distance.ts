/**
 * QUOI     — la distance entre deux points (formule de haversine), et son libellé.
 * POURQUOI — le bouton de visite dit la distance avant qu'on le touche ; le serveur refait le
 *            calcul (PostGIS) et reste seul juge.
 */
const RAYON_TERRE_M = 6_371_000
const rad = (deg: number) => (deg * Math.PI) / 180

export const PORTEE_M = 200

export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 2 * RAYON_TERRE_M * Math.asin(Math.sqrt(h))
}

export function libelleDistance(m: number) {
  if (m < 1000) return `${String(Math.round(m / 10) * 10)} m`
  if (m < 10_000) return `${(m / 1000).toFixed(1).replace('.', ',')} km`
  return `${String(Math.round(m / 1000))} km`
}
