/**
 * QUOI     — les lieux sur la carte : la source regroupée et ses cinq calques, du dessous au
 *            dessus — billes, sceaux, points d'intérêt, pilules, groupes (spec Carte §3).
 * POURQUOI — des calques MapLibre, dessinés par la carte graphique : des milliers de lieux sans
 *            ralentir. Le regroupement au dézoom est celui de MapLibre.
 * ATTENTION — les textes de carte n'existent que dans les polices du fond OpenFreeMap (Noto Sans).
 */
import type { FeatureCollection, Point } from 'geojson'
import type { ExpressionSpecification, Map as Carte, SymbolLayerSpecification } from 'maplibre-gl'
import type { LieuCarte } from '../api/lireCarte'
import type { CouleursCarte } from './couleurs'
import { nomImage } from './sceaux'

export const SOURCE = 'lieux'
export const CALQUES_LIEUX = ['billes', 'sceaux', 'curiosites']
export const CALQUE_GROUPES = 'groupes'

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

const seul: ExpressionSpecification = ['!', ['has', 'point_count']]
const estLieu: ExpressionSpecification = ['==', ['get', 'nature'], 'lieu']
const marque: NonNullable<SymbolLayerSpecification['layout']> = {
  'icon-image': ['get', 'image'],
  'icon-allow-overlap': true,
}

export function ajouterCalques(map: Carte, c: CouleursCarte) {
  map.addSource(SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    cluster: true,
    clusterRadius: 40,
    clusterMaxZoom: 11,
  })
  map.addLayer({
    id: 'billes',
    type: 'symbol',
    source: SOURCE,
    filter: ['all', seul, estLieu, ['==', ['get', 'etat'], 'inconnu']],
    layout: marque,
  })
  map.addLayer({
    id: 'sceaux',
    type: 'symbol',
    source: SOURCE,
    filter: ['all', seul, estLieu, ['!=', ['get', 'etat'], 'inconnu']],
    // Un lieu visité passe au-dessus d'un lieu seulement connu.
    layout: { ...marque, 'symbol-sort-key': ['case', ['==', ['get', 'etat'], 'visite'], 2, 1] },
  })
  map.addLayer({
    id: 'curiosites',
    type: 'symbol',
    source: SOURCE,
    minzoom: DE_PRES,
    filter: ['all', seul, ['==', ['get', 'nature'], 'curiosite']],
    layout: marque,
  })
  map.addLayer({
    id: 'pilules',
    type: 'symbol',
    source: SOURCE,
    minzoom: DE_PRES,
    filter: ['all', seul, ['has', 'pilule']],
    layout: {
      'text-field': ['upcase', ['get', 'pilule']],
      'text-font': ['Noto Sans Bold'],
      'text-size': 8,
      'text-letter-spacing': 0.08,
      'text-anchor': 'top',
      'text-offset': [0, 1.9], // sous le sceau (26 px)
      'icon-image': ['case', ['get', 'moi'], 'pilule-moi', 'pilule'],
      'icon-text-fit': 'both',
      'icon-text-fit-padding': [2, 5, 2, 5],
    },
    paint: { 'text-color': ['case', ['get', 'moi'], c.halo, c.encre] },
  })
  map.addLayer({
    id: CALQUE_GROUPES,
    type: 'symbol',
    source: SOURCE,
    filter: ['has', 'point_count'],
    layout: {
      'icon-image': 'groupe',
      'icon-allow-overlap': true,
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 11,
      'text-allow-overlap': true,
    },
    paint: { 'text-color': c.halo },
  })
}
