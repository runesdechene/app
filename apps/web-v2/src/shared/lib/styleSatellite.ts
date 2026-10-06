/**
 * QUOI     — la vue satellite des cartes où l'on place un point (pose du pin, ajout d'un lieu).
 * POURQUOI — Uriel, 06/10 : « proposer la vue Satellite pour cette partie de la carte ». Tuiles
 *            Esri World Imagery, gratuites et sans clé, déjà utilisées par la V1
 *            (apps/explore-web/src/lib/map-style.ts) ; l'attribution est obligatoire.
 * ATTENTION — la carte globale n'a pas encore de satellite (« à terme », hors de ce chantier).
 *            Le retour au plan repose l'ombrage une seule fois (`once`) : un écouteur permanent
 *            de « style.load » le chercherait aussi sur le satellite, qui n'a pas sa source.
 */
import type { Map as CarteMapLibre, StyleSpecification } from 'maplibre-gl'
import type { CouleursCarte } from './couleursCarte'
import { ajouterOmbrage, FOND, styleParchemin } from './styleCarte'

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

export function appliquerVue(map: CarteMapLibre, vue: VueCarte, couleurs: CouleursCarte) {
  if (vue === 'satellite') {
    map.setStyle(STYLE_SATELLITE)
    return
  }
  map.setStyle(FOND, { transformStyle: (_avant, fond) => styleParchemin(fond, couleurs) })
  map.once('style.load', () => {
    ajouterOmbrage(map, couleurs)
  })
}
