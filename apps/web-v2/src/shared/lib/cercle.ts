/**
 * QUOI     — un cercle de rayon donné, en polygone, pour MapLibre.
 * POURQUOI — partagé : la zone d'un Explorateur qui brouille ses pistes (carte) et le cercle d'un
 *            pin GPS (ajout) se dessinent pareil.
 */

// Un cercle sur la carte, en [lng, lat] : le premier point referme le tracé.
export function cercle(lat: number, lng: number, km: number, n = 48): [number, number][] {
  const points: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n
    points.push([
      lng + (km / (111 * Math.cos((lat * Math.PI) / 180))) * Math.sin(angle),
      lat + (km / 111) * Math.cos(angle),
    ])
  }
  const premier = points[0]
  return premier ? [...points, premier] : points
}
