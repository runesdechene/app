/**
 * QUOI     — les territoires sur la carte (migrations 569-575) : une bordure en tirets courts, une
 *            couleur qui part d'elle et s'efface vers l'intérieur, et un seul nom posé sur la bordure.
 *            Le mien au vert chêne, ceux des autres à l'encre (Uriel, 01/11, Figma 880:2780 ; le blason,
 *            trop envahissant, est retiré le même jour).
 * POURQUOI — sous les lieux : la forme entoure les sceaux sans jamais les couvrir. La base oriente
 *            les anneaux comme GeoJSON (migration 570) ; MapLibre décale un trait dans le repère de
 *            l'écran, où le nord est en bas : à droite du trait, c'est toujours dedans, même autour
 *            d'une enclave — le dégradé s'y décale. Le nom apparaît avec ceux des lieux (zoom 9).
 * ATTENTION — les textes de carte n'existent que dans les polices du fond OpenFreeMap (Noto Sans).
 */
import type { Feature, FeatureCollection, MultiPolygon, Point } from 'geojson'
import type { ExpressionSpecification, Map as Carte } from 'maplibre-gl'
import type { TerritoireRevendique } from '../api/lireCarte'
import type { CouleursCarte } from '@/shared/lib/couleursCarte'

export const SOURCE_TERRITOIRES = 'territoires'
export const CALQUE_NOMS_TERRITOIRES = 'territoires-noms'
const AVANT = 'billes' // le premier calque des lieux (calques.ts)
const NOMS_DES = 9 // comme le nom des lieux (calques.ts)

type Proprietes = { id: string; nom: string; moi: boolean }

export function enGeoJSONTerritoires(
  territoires: TerritoireRevendique[],
): FeatureCollection<MultiPolygon | Point, Proprietes> {
  return {
    type: 'FeatureCollection',
    features: territoires.flatMap((t): Feature<MultiPolygon | Point, Proprietes>[] => {
      const proprietes = { id: t.id, nom: t.nom, moi: t.moi }
      return [
        {
          type: 'Feature',
          geometry: { type: 'MultiPolygon', coordinates: t.morceaux },
          properties: proprietes,
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: t.ancre },
          properties: proprietes,
        },
      ]
    }),
  }
}

export function poserTerritoires(map: Carte, c: CouleursCarte) {
  const couleur: ExpressionSpecification = ['case', ['get', 'moi'], c.chene, c.encre]
  const forme: ExpressionSpecification = ['!=', ['geometry-type'], 'Point']
  map.addSource(SOURCE_TERRITOIRES, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  // Le dégradé : un trait large, flouté, glissé à l'intérieur — fort au bord, nul au centre.
  map.addLayer(
    {
      id: 'territoires-degrade',
      type: 'line',
      source: SOURCE_TERRITOIRES,
      filter: forme,
      paint: {
        'line-color': couleur,
        'line-opacity': 0.45,
        'line-width': 18,
        'line-offset': 9, // à droite du trait : dedans
        'line-blur': 16,
      },
    },
    AVANT,
  )
  map.addLayer(
    {
      id: 'territoires-bordure',
      type: 'line',
      source: SOURCE_TERRITOIRES,
      filter: forme,
      layout: { 'line-cap': 'round' },
      paint: {
        'line-color': couleur,
        'line-opacity': 0.85,
        'line-width': 1.6,
        'line-dasharray': [2.5, 2.2], // en largeurs de trait : 4 px de tiret, 3,5 px de vide
      },
    },
    AVANT,
  )
  // Le nom, posé sur la bordure, en capitales espacées sur un halo parchemin.
  map.addLayer({
    id: CALQUE_NOMS_TERRITOIRES,
    type: 'symbol',
    source: SOURCE_TERRITOIRES,
    minzoom: NOMS_DES,
    filter: ['==', ['geometry-type'], 'Point'],
    layout: {
      'text-field': ['upcase', ['get', 'nom']],
      'text-font': ['Noto Sans Bold'],
      'text-size': 11,
      'text-letter-spacing': 0.2,
    },
    paint: {
      'text-color': couleur,
      'text-halo-color': c.fond,
      'text-halo-width': 2,
    },
  })
}
