/**
 * QUOI     — les lieux sur la carte : la source et ses quatre calques, du dessous au dessus —
 *            billes, sceaux, points d'intérêt, pilules (spec Carte §3).
 * POURQUOI — des calques MapLibre, dessinés par la carte graphique : des milliers de lieux sans
 *            ralentir. Aucun regroupement (Uriel, 28/09, comme la V1) : dézoomée, la carte montre
 *            tous les lieux, en plus petit — l'effet de constellation.
 * ATTENTION — les textes de carte n'existent que dans les polices du fond OpenFreeMap (Noto Sans).
 */
import type { FeatureCollection, Point } from 'geojson'
import type {
  AddLayerObject,
  ExpressionSpecification,
  SourceSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl'
import type { LieuCarte } from '../api/lireCarte'
import type { CouleursCarte } from './couleurs'
import { nomImage } from './sceaux'

export const SOURCE = 'lieux'
export const CALQUES_LIEUX = ['billes', 'sceaux', 'curiosites']
export const CALQUE_SURVOL = 'survol'

// De près seulement : les pilules et les points d'intérêt ne chargent pas la vue d'ensemble.
const DE_PRES = 12

type Proprietes = {
  id: string
  etat: LieuCarte['etat']
  nature: LieuCarte['nature']
  image: string
  pilule?: string
  moi?: boolean
}

export function enGeoJSON(
  lieux: LieuCarte[],
  couleurTypes: boolean,
): FeatureCollection<Point, Proprietes> {
  return {
    type: 'FeatureCollection',
    features: lieux.map((l) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [l.lng, l.lat] },
      properties: {
        id: l.id,
        etat: l.etat,
        nature: l.nature,
        image: nomImage(l, couleurTypes),
        ...(l.revendication && { pilule: l.revendication.nom, moi: l.revendication.moi }),
      },
    })),
  }
}

const estLieu: ExpressionSpecification = ['==', ['get', 'nature'], 'lieu']

// La marque grandit avec le zoom : un point de loin, le sceau entier de près.
const PALIERS: [zoom: number, taille: number][] = [
  [4, 0.5],
  [8, 0.8],
  [12, 1.15],
]

// Une taille agrandie (le survol) multiplie chaque palier : MapLibre veut la courbe de zoom au
// premier niveau, jamais enveloppée dans un calcul.
export function taille(facteur = 1): ExpressionSpecification {
  const paliers = PALIERS.flatMap(([zoom, t]) => [zoom, Math.round(t * facteur * 1000) / 1000])
  return ['interpolate', ['linear'], ['zoom'], ...paliers]
}

const marque: NonNullable<SymbolLayerSpecification['layout']> = {
  'icon-image': ['get', 'image'],
  'icon-size': taille(),
  'icon-allow-overlap': true,
  'icon-ignore-placement': true,
}

// Ce que ce fichier demande à la carte, et rien de plus.
type SupportDeCalques = {
  addSource: (id: string, source: SourceSpecification) => void
  addLayer: (calque: AddLayerObject) => void
}

export function ajouterCalques(map: SupportDeCalques, c: CouleursCarte) {
  map.addSource(SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({
    id: 'billes',
    type: 'symbol',
    source: SOURCE,
    filter: ['all', estLieu, ['==', ['get', 'etat'], 'inconnu']],
    layout: marque,
  })
  map.addLayer({
    id: 'sceaux',
    type: 'symbol',
    source: SOURCE,
    filter: ['all', estLieu, ['!=', ['get', 'etat'], 'inconnu']],
    // Un lieu visité passe au-dessus d'un lieu seulement connu.
    layout: { ...marque, 'symbol-sort-key': ['case', ['==', ['get', 'etat'], 'visite'], 2, 1] },
  })
  map.addLayer({
    id: 'curiosites',
    type: 'symbol',
    source: SOURCE,
    minzoom: DE_PRES,
    filter: ['==', ['get', 'nature'], 'curiosite'],
    layout: marque,
  })
  // Le lieu survolé, redessiné par-dessus : c'est lui qui grossit et « pulse » au clic (survol.ts).
  map.addLayer({
    id: CALQUE_SURVOL,
    type: 'symbol',
    source: SOURCE,
    filter: ['==', ['get', 'id'], ''],
    layout: marque,
  })
  map.addLayer({
    id: 'pilules',
    type: 'symbol',
    source: SOURCE,
    minzoom: DE_PRES,
    filter: ['has', 'pilule'],
    layout: {
      'text-field': ['upcase', ['get', 'pilule']],
      'text-font': ['Noto Sans Bold'],
      'text-size': 8,
      'text-letter-spacing': 0.08,
      'text-anchor': 'top',
      'text-offset': [0, 2.1], // sous le sceau (26 px × 1,15 de près)
      'icon-image': ['case', ['get', 'moi'], 'pilule-moi', 'pilule'],
      'icon-text-fit': 'both',
      'icon-text-fit-padding': [2, 5, 2, 5],
    },
    paint: { 'text-color': ['case', ['get', 'moi'], c.halo, c.encre] },
  })
}
