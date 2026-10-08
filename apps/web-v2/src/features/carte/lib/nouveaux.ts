/**
 * QUOI     — les nouveaux lieux sur la carte (Figma 525:740, piste 2 « l'encre », Uriel 08/10) : autour
 *            de la marque d'un lieu ajouté depuis moins de 14 jours et pas encore ouvert, un fin anneau
 *            d'encre qui s'élargit et s'efface, en boucle lente ; de plus près, une gélule d'encre
 *            « NOUVEAU » sous la marque. La marque d'un lieu neuf passe au-dessus des autres (son propre
 *            calque, calques.ts).
 * POURQUOI — les couleurs par nature faisaient « pêle-mêle » (Uriel, 08/10) : une seule encre, un contour
 *            seul. On le remarque par le mouvement, pas par la couleur. L'anneau est plus lent que l'onde
 *            des énigmes, pour ne pas les confondre. Calques MapLibre sur la source des lieux : la
 *            propriété `nouveau` (migration 469) suffit.
 * ATTENTION — la taille suit PALIERS_NOUVEAUX (calques.ts), au premier niveau de l'expression de zoom ;
 *            l'anneau s'anime image par image (comme `fairePulser` des énigmes). Animations réduites :
 *            un anneau fixe.
 */
import type { AddLayerObject, ExpressionSpecification, FilterSpecification, Map as Carte } from 'maplibre-gl'
import type { CouleursCarte } from '@/shared/lib/couleursCarte'
import { PALIERS_NOUVEAUX, SOURCE } from './calques'

export const CALQUE_ANNEAU_NOUVEAUX = 'nouveaux-anneau'
export const CALQUE_GELULE_NOUVEAUX = 'nouveaux-gelule'

const PERIODE = 3000 // ms : plus lent que les énigmes (2 200), pour qu'on ne les confonde pas
const RAYON = 13 // le rayon d'une marque à la taille 1 (sceau de 26 px)
const ELAN = 8 // de combien l'anneau s'élargit au-delà de la marque
const TRAIT = 1.2 // l'épaisseur de l'anneau
const DE_PLUS_PRES = 9 // la gélule ne s'affiche qu'à partir de là : de loin, l'anneau suffit

const estNouveau: FilterSpecification = ['==', ['get', 'nouveau'], true]

export function rayonAuZoom(rayon: number): ExpressionSpecification {
  return ['interpolate', ['linear'], ['zoom'], ...PALIERS_NOUVEAUX.flatMap(([z, t]) => [z, Math.round(rayon * t * 1000) / 1000])]
}

// Où en est l'anneau à la phase `t` (0 → 1) : il naît transparent au bord de la marque, se dessine en
// s'élargissant, puis s'efface — jamais d'apparition d'un coup (Uriel, 08/10 : « brutal »).
export function anneauNouveau(t: number): { rayon: number; opacite: number } {
  return { rayon: RAYON + 1 + t * ELAN, opacite: 0.8 * Math.sin(Math.PI * t) }
}

export function calqueAnneau(c: CouleursCarte, ecran: number): AddLayerObject {
  const { rayon, opacite } = anneauNouveau(0.5) // la pose d'un anneau fixe (animations réduites)
  return {
    id: CALQUE_ANNEAU_NOUVEAUX,
    type: 'circle',
    source: SOURCE,
    filter: estNouveau,
    paint: {
      'circle-opacity': 0, // un contour seul
      'circle-radius': rayonAuZoom(rayon * ecran),
      'circle-stroke-color': c.encre,
      'circle-stroke-width': TRAIT * ecran,
      'circle-stroke-opacity': opacite,
      // Pas de fondu : on change ces valeurs à chaque image (sinon les fondus se chevauchent).
      'circle-radius-transition': { duration: 0, delay: 0 },
      'circle-stroke-opacity-transition': { duration: 0, delay: 0 },
    },
  }
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
      // Deux lieux neufs voisins : une seule gélule, pour ne pas les empiler (l'anneau reste aux deux).
      'text-allow-overlap': false,
      'icon-allow-overlap': false,
    },
    paint: { 'text-color': c.halo, 'icon-color': c.encre },
  }
}

// L'anneau se pose au-dessus de tous les lieux ordinaires, juste sous la marque du lieu neuf (le calque
// « nouveaux » de calques.ts) ; la gélule par-dessus tout ; puis l'anneau s'anime.
export function poserNouveaux(map: Carte, c: CouleursCarte, ecran: number): () => void {
  map.addLayer(calqueAnneau(c, ecran), 'nouveaux')
  map.addLayer(calqueGelule(c))
  return faireRayonner(map, ecran)
}

function faireRayonner(map: Carte, ecran: number): () => void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => undefined
  let image = 0
  const pas = (maintenant: number) => {
    if (!map.getLayer(CALQUE_ANNEAU_NOUVEAUX)) return
    const { rayon, opacite } = anneauNouveau((maintenant % PERIODE) / PERIODE)
    map.setPaintProperty(CALQUE_ANNEAU_NOUVEAUX, 'circle-radius', rayonAuZoom(rayon * ecran))
    map.setPaintProperty(CALQUE_ANNEAU_NOUVEAUX, 'circle-stroke-opacity', opacite)
    image = requestAnimationFrame(pas)
  }
  image = requestAnimationFrame(pas)
  return () => {
    cancelAnimationFrame(image)
  }
}
