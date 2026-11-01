/**
 * QUOI     — la forme des territoires sur la carte (migrations 569-570) : une bordure en tirets
 *            courts et une couleur qui part d'elle et s'efface vers l'intérieur. Le mien au vert
 *            chêne, ceux des autres à l'encre (Uriel, 01/11, Figma 880:2780). Le nom et qui le tient
 *            sont sur le blason (`blasons.ts`).
 * POURQUOI — sous les lieux : la forme entoure les sceaux sans jamais les couvrir. La base oriente
 *            les anneaux comme GeoJSON (migration 570) ; MapLibre décale un trait dans le repère de
 *            l'écran, où le nord est en bas : à droite du trait, c'est toujours dedans, même autour
 *            d'une enclave — le dégradé s'y décale.
 */
import type { FeatureCollection, MultiPolygon } from 'geojson'
import type { ExpressionSpecification, Map as Carte } from 'maplibre-gl'
import type { TerritoireRevendique } from '../api/lireCarte'
import type { CouleursCarte } from '@/shared/lib/couleursCarte'

export const SOURCE_TERRITOIRES = 'territoires'
const AVANT = 'billes' // le premier calque des lieux (calques.ts)

export function enGeoJSONTerritoires(
  territoires: TerritoireRevendique[],
): FeatureCollection<MultiPolygon, { moi: boolean }> {
  return {
    type: 'FeatureCollection',
    features: territoires.map((t) => ({
      type: 'Feature',
      geometry: { type: 'MultiPolygon', coordinates: t.morceaux },
      properties: { moi: t.moi },
    })),
  }
}

export function poserTerritoires(map: Carte, c: CouleursCarte) {
  const couleur: ExpressionSpecification = ['case', ['get', 'moi'], c.chene, c.encre]
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
}
