/**
 * QUOI     — ranger les Actifs (les plus proches d'abord), dire leur distance, dessiner la zone
 *            d'un Explorateur qui brouille ses pistes.
 * POURQUOI — la base rend le centre d'une case d'environ 20 km, à 15 km au plus du vrai point : la
 *            zone de 25 km (Uriel, 01/10) le contient donc toujours. On montre « quelque part par
 *            ici », jamais un faux point précis.
 */
import type { Feature, FeatureCollection, Polygon } from 'geojson'
import type { AddLayerObject, SourceSpecification } from 'maplibre-gl'
import { distanceKm, formatDistance, type Point } from '@/shared/lib/distance'
import { ilYA } from '@/shared/lib/ilYA'
import type { Actif } from '../api/lireActifs'

export const RAYON_ZONE_KM = 25

const position = (a: Actif): Point => ({ latitude: a.lat, longitude: a.lng })

export function parProximite(actifs: Actif[], moi: Point | null): Actif[] {
  if (!moi) return actifs
  return [...actifs].sort((a, b) => distanceKm(moi, position(a)) - distanceKm(moi, position(b)))
}

const majuscule = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1)

// « En ligne », ou depuis quand on ne l'a pas vu (« Il y a 23 min »).
export function etat(a: Actif): string {
  return a.enLigne ? 'En ligne' : majuscule(ilYA(a.vuA))
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

export const ZONES = 'zones-actifs'

type SupportDeZones = {
  addSource: (id: string, source: SourceSpecification) => void
  addLayer: (calque: AddLayerObject, avant?: string) => void
}

// Les zones des pistes brouillées, sous les lieux : un voile de la couleur des routes, un
// contour pointillé ; plus pâles pour qui est parti depuis peu.
export function ajouterZones(map: SupportDeZones, couleur: string, avant: string) {
  map.addSource(ZONES, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer(
    {
      id: `${ZONES}-voile`,
      type: 'fill',
      source: ZONES,
      paint: {
        'fill-color': couleur,
        'fill-opacity': ['case', ['get', 'recent'], 0.05, 0.1],
      },
    },
    avant,
  )
  map.addLayer(
    {
      id: `${ZONES}-contour`,
      type: 'line',
      source: ZONES,
      paint: {
        'line-color': couleur,
        'line-opacity': ['case', ['get', 'recent'], 0.3, 0.55],
        'line-width': 1.5,
        'line-dasharray': [3, 3],
      },
    },
    avant,
  )
}
