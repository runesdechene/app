/**
 * QUOI     — les nouveaux lieux sur la carte (Figma 793:1996, piste 6 « l'aube dorée », Uriel 24/10) :
 *            autour de la marque d'un lieu ajouté depuis moins de 14 jours et pas encore ouvert, une
 *            lumière dorée, un fin anneau d'or qui s'élargit et s'efface en boucle lente, et deux
 *            étincelles qui scintillent tour à tour en haut à droite ; une gélule d'encre « NOUVEAU »
 *            écrite en or sous la marque, à tous les zooms. Le lieu reste à sa place et à sa taille.
 * POURQUOI — l'anneau d'encre seul (08/10) ne se voyait pas assez (Uriel, 24/10). Une seule couleur pour
 *            tous les lieux neufs : les couleurs par nature faisaient « pêle-mêle » (08/10). L'anneau
 *            est plus lent que l'onde des énigmes, pour ne pas les confondre. Calques MapLibre sur la
 *            source des lieux : la propriété `nouveau` (migration 469) suffit.
 * ATTENTION — les tailles suivent la courbe des marques (PALIERS, calques.ts), au premier niveau de
 *            l'expression de zoom ; l'anneau et les étincelles s'animent image par image (comme
 *            `fairePulser` des énigmes). Animations réduites : tout reste fixe.
 */
import type {
  AddLayerObject,
  ExpressionSpecification,
  FilterSpecification,
  Map as Carte,
} from 'maplibre-gl'
import type { CouleursCarte } from '@/shared/lib/couleursCarte'
import { PALIERS, SOURCE, taille } from './calques'

export const CALQUE_ANNEAU_NOUVEAUX = 'nouveaux-anneau'
export const CALQUE_GELULE_NOUVEAUX = 'nouveaux-gelule'
export const CALQUE_AURA_NOUVEAUX = 'nouveaux-aura'

const PERIODE = 3000 // ms : plus lent que les énigmes (2 200), pour qu'on ne les confonde pas
const RAYON = 13 // le rayon d'une marque à la taille 1 (sceau de 26 px)
const ELAN = 4 // de combien l'anneau s'élargit au-delà de la marque (réduit de moitié, Uriel 08/10)
const TRAIT = 1.2 // l'épaisseur de l'anneau
const DE_PLUS_PRES = 7 // la gélule a sa pleine taille dès l'échelle d'une région
const AURA = 32 // le rayon de la lumière dorée, à la taille 1 (2,5 fois la marque)

// Les deux étincelles ✦ (l'image `etincelle`, sceaux.ts) : leur taille, et leur place depuis le centre de
// la marque (en pixels de l'image ; MapLibre les multiplie par la taille).
const ETINCELLES = [
  { id: 'nouveaux-etincelle-1', taille: 1.1, decalage: [11, -14] },
  { id: 'nouveaux-etincelle-2', taille: 0.7, decalage: [27, -8] },
] as const

const estNouveau: FilterSpecification = ['==', ['get', 'nouveau'], true]

// Le lieu que la carte propose de visiter, sur place (revendiquer par GPS, 21/10), reçoit le même
// anneau : on le repère par le mouvement, comme un lieu neuf.
export function filtreAnneau(aPortee: string | null): FilterSpecification {
  if (aPortee === null) return estNouveau
  return ['any', ['==', ['get', 'nouveau'], true], ['==', ['get', 'id'], aPortee]]
}

export function montrerAPortee(map: Carte, aPortee: string | null) {
  if (map.getLayer(CALQUE_ANNEAU_NOUVEAUX))
    map.setFilter(CALQUE_ANNEAU_NOUVEAUX, filtreAnneau(aPortee))
}

export function rayonAuZoom(rayon: number): ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    ...PALIERS.flatMap(([z, t]) => [z, Math.round(rayon * t * 1000) / 1000]),
  ]
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
      'circle-stroke-color': c.or,
      'circle-stroke-width': TRAIT * ecran,
      'circle-stroke-opacity': opacite,
      // Pas de fondu : on change ces valeurs à chaque image (sinon les fondus se chevauchent).
      'circle-radius-transition': { duration: 0, delay: 0 },
      'circle-stroke-opacity-transition': { duration: 0, delay: 0 },
    },
  }
}

// La lumière dorée : un disque d'or flou, sous toutes les marques.
export function calqueAura(c: CouleursCarte, ecran: number): AddLayerObject {
  return {
    id: CALQUE_AURA_NOUVEAUX,
    type: 'circle',
    source: SOURCE,
    filter: estNouveau,
    paint: {
      'circle-color': c.or,
      'circle-blur': 1, // flou du centre jusqu'au bord : une lueur, pas un disque
      'circle-opacity': 0.85,
      'circle-radius': rayonAuZoom(AURA * ecran),
    },
  }
}

// L'éclat d'une étincelle à la phase `t` (0 → 1) : elle ne s'éteint jamais tout à fait. La seconde a
// une demi-période de retard, pour scintiller quand la première pâlit.
export function eclatEtincelle(t: number): number {
  return 0.3 + 0.7 * Math.abs(Math.sin(Math.PI * t))
}

export function calquesEtincelles(ecran: number): AddLayerObject[] {
  return ETINCELLES.map((e) => ({
    id: e.id,
    type: 'symbol',
    source: SOURCE,
    filter: estNouveau,
    layout: {
      'icon-image': 'etincelle',
      'icon-size': taille(e.taille * ecran),
      'icon-offset': [...e.decalage],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: { 'icon-opacity-transition': { duration: 0, delay: 0 } },
  }))
}

// La gélule « NOUVEAU », dessinée d'un bloc avec son mot (sceaux.ts). À tous les zooms, même de très
// loin (Uriel, 22/10) : un lieu neuf doit se voir sur la France entière. Pleine taille dès l'échelle
// d'une région, plus petite seulement de très loin.
export function calqueGelule(): AddLayerObject {
  return {
    id: CALQUE_GELULE_NOUVEAUX,
    type: 'symbol',
    source: SOURCE,
    filter: estNouveau,
    layout: {
      'icon-image': 'gelule-nouveau',
      'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.55, DE_PLUS_PRES, 1],
      // Sous la marque, à la place du nom de qui l'a revendiqué (calques.ts ne le montre pas sur un
      // lieu neuf) : jamais les deux empilés. Le décalage grandit avec la gélule (× icon-size).
      'icon-anchor': 'top',
      'icon-offset': [0, 16],
      // Deux lieux neufs voisins : une seule gélule, pour ne pas les empiler (l'anneau reste aux deux).
      'icon-allow-overlap': false,
    },
  }
}

// La lumière sous toutes les marques ; l'anneau et les étincelles au-dessus (sous le lieu survolé),
// pour qu'aucun voisin ne les cache ; la gélule par-dessus tout ; puis l'anneau et les étincelles
// s'animent.
export function poserNouveaux(map: Carte, c: CouleursCarte, ecran: number): () => void {
  map.addLayer(calqueAura(c, ecran), 'billes')
  map.addLayer(calqueAnneau(c, ecran), 'survol')
  for (const calque of calquesEtincelles(ecran)) map.addLayer(calque, 'survol')
  map.addLayer(calqueGelule())
  return faireRayonner(map, ecran)
}

function faireRayonner(map: Carte, ecran: number): () => void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => undefined
  let image = 0
  const pas = (maintenant: number) => {
    if (!map.getLayer(CALQUE_ANNEAU_NOUVEAUX)) return
    const t = (maintenant % PERIODE) / PERIODE
    const { rayon, opacite } = anneauNouveau(t)
    map.setPaintProperty(CALQUE_ANNEAU_NOUVEAUX, 'circle-radius', rayonAuZoom(rayon * ecran))
    map.setPaintProperty(CALQUE_ANNEAU_NOUVEAUX, 'circle-stroke-opacity', opacite)
    ETINCELLES.forEach((e, i) => {
      map.setPaintProperty(e.id, 'icon-opacity', eclatEtincelle(t + i / 2))
    })
    image = requestAnimationFrame(pas)
  }
  image = requestAnimationFrame(pas)
  return () => {
    cancelAnimationFrame(image)
  }
}
