/**
 * QUOI     — les nouveaux lieux sur la carte (Figma 523:722, « A en couleur, avec C en plus », Uriel
 *            08/10) : sous la marque d'un lieu ajouté depuis moins de 14 jours et pas encore ouvert,
 *            un halo et une onde à la couleur de sa nature, qui rayonne lentement ; de plus près, une
 *            gélule « NOUVEAU » sous la marque (Uriel, 08/10 : « pour que les gens comprennent »), à la
 *            couleur du lieu elle aussi. La marque d'un lieu neuf passe au-dessus des autres (son
 *            propre calque, calques.ts).
 * POURQUOI — ce qui rayonne appelle à être touché (comme le « ? » des énigmes) ; la couleur dit déjà
 *            ce qu'on va découvrir. L'onde est plus lente que celle des énigmes, pour ne pas les
 *            confondre. Calques MapLibre sur la source des lieux : la propriété `nouveau` (migration
 *            469) suffit, rien à suivre à part.
 * ATTENTION — la taille suit la courbe des marques (`taille` de calques.ts, au premier niveau de
 *            l'expression de zoom) ; l'onde s'anime image par image (comme `fairePulser` des énigmes).
 *            Animations réduites : le halo seul.
 */
import type { AddLayerObject, ExpressionSpecification, FilterSpecification, Map as Carte } from 'maplibre-gl'
import type { CouleursCarte } from '@/shared/lib/couleursCarte'
import { PALIERS_NOUVEAUX, SOURCE } from './calques'

export const CALQUE_HALO_NOUVEAUX = 'nouveaux-halo'
export const CALQUE_ONDE_NOUVEAUX = 'nouveaux-onde'
export const CALQUE_GELULE_NOUVEAUX = 'nouveaux-gelule'

const PERIODE = 3000 // ms : plus lente que les énigmes (2 200), pour qu'on ne les confonde pas
const RAYON = 13 // le rayon d'une marque à la taille 1 (sceau de 26 px)
const DE_PLUS_PRES = 9 // la gélule ne s'affiche qu'à partir de là : de loin, l'onde suffit

const estNouveau: FilterSpecification = ['==', ['get', 'nouveau'], true]

// La courbe de taille d'un lieu neuf, qui rétrécit moins que les autres de loin : PALIERS_NOUVEAUX
// (calques.ts). MapLibre veut la courbe de zoom au premier niveau.

export function rayonAuZoom(rayon: number): ExpressionSpecification {
  return ['interpolate', ['linear'], ['zoom'], ...PALIERS_NOUVEAUX.flatMap(([z, t]) => [z, Math.round(rayon * t * 1000) / 1000])]
}

// Où en est l'onde à la phase `t` (0 → 1) : elle part du bord de la marque, s'élargit, s'efface.
export function ondeNouveau(t: number): { rayon: number; opacite: number } {
  return { rayon: RAYON + t * 16, opacite: 0.5 * (1 - t) ** 2 }
}

export function calquesNouveaux(c: CouleursCarte, ecran: number): AddLayerObject[] {
  const couleur: ExpressionSpecification = ['coalesce', ['get', 'couleur'], c.cire]
  return [
    {
      id: CALQUE_HALO_NOUVEAUX,
      type: 'circle',
      source: SOURCE,
      filter: estNouveau,
      paint: { 'circle-color': couleur, 'circle-opacity': 0.4, 'circle-radius': rayonAuZoom((RAYON + 4) * ecran) },
    },
    {
      id: CALQUE_ONDE_NOUVEAUX,
      type: 'circle',
      source: SOURCE,
      filter: estNouveau,
      paint: {
        'circle-color': couleur,
        'circle-opacity': 0,
        'circle-radius': rayonAuZoom(RAYON * ecran),
        // Pas de fondu : on change ces valeurs à chaque image (sinon les fondus se chevauchent).
        'circle-radius-transition': { duration: 0, delay: 0 },
        'circle-opacity-transition': { duration: 0, delay: 0 },
      },
    },
  ]
}

export function calqueGelule(c: CouleursCarte): AddLayerObject {
  return {
    id: CALQUE_GELULE_NOUVEAUX,
    type: 'symbol',
    source: SOURCE,
    minzoom: DE_PLUS_PRES,
    filter: estNouveau,
    layout: {
      'text-field': 'NOUVEAU',
      'text-font': ['Noto Sans Bold'],
      'text-size': 8,
      'text-letter-spacing': 0.08,
      // Sous la marque, comme un nom ; dès le zoom 12, un lieu revendiqué a déjà sa pilule à cet
      // endroit (calques.ts) : la gélule se pose alors juste dessous.
      'text-anchor': 'top',
      'text-offset': ['step', ['zoom'], ['literal', [0, 2.1]], 12, ['case', ['has', 'pilule'], ['literal', [0, 3.9]], ['literal', [0, 2.1]]]],
      'icon-image': 'pilule-nouveau',
      'icon-text-fit': 'both',
      'icon-text-fit-padding': [2, 5, 2, 5],
      // Deux lieux neufs voisins : une seule gélule, pour ne pas les empiler (l'onde reste aux deux).
      'text-allow-overlap': false,
      'icon-allow-overlap': false,
    },
    paint: { 'text-color': c.halo, 'icon-color': ['coalesce', ['get', 'couleur'], c.cire] },
  }
}

// Halo et onde se posent au-dessus de tous les lieux ordinaires, juste sous la marque du lieu neuf
// (le calque « nouveaux » de calques.ts) : de loin, les autres ne les recouvrent plus (Uriel, 08/10).
// La gélule, par-dessus tout ; puis l'onde s'anime.
export function poserNouveaux(map: Carte, c: CouleursCarte, ecran: number): () => void {
  for (const calque of calquesNouveaux(c, ecran)) map.addLayer(calque, 'nouveaux')
  map.addLayer(calqueGelule(c))
  return faireRayonner(map, ecran)
}

function faireRayonner(map: Carte, ecran: number): () => void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => undefined
  let image = 0
  const pas = (maintenant: number) => {
    if (!map.getLayer(CALQUE_ONDE_NOUVEAUX)) return
    const { rayon, opacite } = ondeNouveau((maintenant % PERIODE) / PERIODE)
    map.setPaintProperty(CALQUE_ONDE_NOUVEAUX, 'circle-radius', rayonAuZoom(rayon * ecran))
    map.setPaintProperty(CALQUE_ONDE_NOUVEAUX, 'circle-opacity', opacite)
    image = requestAnimationFrame(pas)
  }
  image = requestAnimationFrame(pas)
  return () => {
    cancelAnimationFrame(image)
  }
}
