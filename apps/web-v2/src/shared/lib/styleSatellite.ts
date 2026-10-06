/**
 * QUOI     — la vue satellite des cartes où l'on place un point (pose du pin, ajout d'un lieu).
 * POURQUOI — Uriel, 06/10 : « proposer la vue Satellite pour cette partie de la carte ». Tuiles
 *            Esri World Imagery, gratuites et sans clé, déjà utilisées par la V1
 *            (apps/explore-web/src/lib/map-style.ts) ; l'attribution est obligatoire, et visible
 *            (`attributionVisible`).
 * ATTENTION — la carte globale n'a pas encore de satellite (« à terme », hors de ce chantier).
 *            Chaque carte qui l'utilise garde UN gestionnaire permanent de « style.load » qui pose
 *            ce qui dépend du style (l'ombrage, qui ignore le satellite faute de source de relief) :
 *            `diff: false` remplace le style en entier, donc « style.load » repart à chaque
 *            changement de vue. Aucun `once` ici : il s'empilerait avec ce gestionnaire.
 */
import type { Map as CarteMapLibre, StyleSpecification } from 'maplibre-gl'
import type { CouleursCarte } from './couleursCarte'
import { maplibregl } from './maplibre'
import { FOND, styleParchemin } from './styleCarte'

export type VueCarte = 'plan' | 'satellite'

export const STYLE_SATELLITE: StyleSpecification = {
  version: 8,
  sources: {
    'esri-satellite': {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Esri, Maxar, Earthstar Geographics',
    },
  },
  layers: [{ id: 'satellite', type: 'raster', source: 'esri-satellite' }],
}

// L'attribution des tuiles, dépliée, en haut à droite (le CSS de chaque écran la pose sous le
// bouton Plan / Satellite) : en bas, la feuille la cachait, et Esri exige qu'elle se voie.
export function attributionVisible(map: CarteMapLibre) {
  map.addControl(new maplibregl.AttributionControl({ compact: false }), 'top-right')
}

// La vue en cours se lit sur la carte elle-même : son calque d'imagerie est là ou non.
export function estSatellite(carte: { getLayer: (id: string) => unknown }): boolean {
  return carte.getLayer('satellite') !== undefined
}

export function appliquerVue(map: CarteMapLibre, vue: VueCarte, couleurs: CouleursCarte) {
  if (vue === 'satellite') {
    map.setStyle(STYLE_SATELLITE, { diff: false })
    return
  }
  map.setStyle(FOND, {
    diff: false,
    transformStyle: (_avant, fond) => styleParchemin(fond, couleurs),
  })
}
