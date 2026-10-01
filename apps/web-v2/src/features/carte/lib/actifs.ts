/**
 * QUOI     — ranger les Actifs (les plus proches d'abord), dire leur distance, dessiner la zone
 *            d'un Explorateur qui brouille ses pistes.
 * POURQUOI — la zone (50 km) contient toujours sa vraie position, que la base a déplacée de
 *            40 km au plus : on montre « quelque part par ici », jamais un faux point précis.
 */
import type { Feature, FeatureCollection, Polygon } from 'geojson'
import { distanceKm, formatDistance, type Point } from '@/shared/lib/distance'
import type { Actif } from '../api/lireActifs'

export const RAYON_ZONE_KM = 50

const position = (a: Actif): Point => ({ latitude: a.lat, longitude: a.lng })

export function parProximite(actifs: Actif[], moi: Point | null): Actif[] {
  if (!moi) return actifs
  return [...actifs].sort((a, b) => distanceKm(moi, position(a)) - distanceKm(moi, position(b)))
}

export function distanceDe(actif: Actif, moi: Point | null): string | null {
  if (!moi) return null
  const texte = formatDistance(distanceKm(moi, position(actif)))
  return actif.brouille ? `~ ${texte}` : texte
}

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

type Zone = { id: string; recent: boolean }

export function zonesEnGeoJSON(actifs: Actif[]): FeatureCollection<Polygon, Zone> {
  return {
    type: 'FeatureCollection',
    features: actifs
      .filter((a) => a.brouille)
      .map((a): Feature<Polygon, Zone> => ({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [cercle(a.lat, a.lng, RAYON_ZONE_KM)] },
        properties: { id: a.id, recent: !a.enLigne },
      })),
  }
}
