/**
 * QUOI     — les nouveaux lieux sur la carte (Uriel, 24/10) : un lieu ajouté depuis moins de 14 jours
 *            et pas encore ouvert porte un sceau d'encre plein (sceaux.ts), au premier plan, entouré
 *            d'une lueur et d'un fin anneau d'encre qui s'élargit et s'efface en boucle lente ; de près
 *            seulement, une gélule d'encre « NOUVEAU » sous la marque. Le lieu
 *            reste à sa place et à sa taille.
 * POURQUOI — l'anneau d'encre seul (08/10), puis l'aube dorée, ne se voyaient pas assez parmi les
 *            lieux (Uriel, 24/10). Une seule couleur pour tous les lieux neufs : les couleurs par nature
 *            faisaient « pêle-mêle » (08/10). Le mot de loin chargeait la carte : le sceau suffit à
 *            signaler. Calques MapLibre sur la source des lieux : la propriété `nouveau` (migration 469).
 * ATTENTION — noir et non rouge : le rouge est aux énigmes (Uriel, 24/10). L'anneau est plus lent que
 *            leur onde, pour ne pas les confondre.
 *            Les tailles suivent la courbe des marques (PALIERS, calques.ts), au premier niveau de
 *            l'expression de zoom ; l'anneau s'anime image par image (comme `fairePulser` des
 *            énigmes). Animations réduites : un anneau fixe.
 */
import type {
  AddLayerObject,
  ExpressionSpecification,
  FilterSpecification,
  Map as Carte,
} from 'maplibre-gl'
import type { CouleursCarte } from '@/shared/lib/couleursCarte'
import { PALIERS, SOURCE } from './calques'

export const CALQUE_ANNEAU_NOUVEAUX = 'nouveaux-anneau'
export const CALQUE_GELULE_NOUVEAUX = 'nouveaux-gelule'
export const CALQUE_LUEUR_NOUVEAUX = 'nouveaux-lueur'

const PERIODE = 3000 // ms : plus lent que les énigmes (2 200), pour qu'on ne les confonde pas
const RAYON = 13 // le rayon d'une marque à la taille 1 (sceau de 26 px)
const ELAN = 4 // de combien l'anneau s'élargit au-delà de la marque (réduit de moitié, Uriel 08/10)
const TRAIT = 1.2 // l'épaisseur de l'anneau
const LUEUR = 22 // le rayon de la lueur, à la taille 1
const DE_PRES = 9 // « NOUVEAU » dès l'échelle d'un département, comme les noms des revendications

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
      'circle-stroke-color': c.encre,
      'circle-stroke-width': TRAIT * ecran,
      'circle-stroke-opacity': opacite,
      // Pas de fondu : on change ces valeurs à chaque image (sinon les fondus se chevauchent).
      'circle-radius-transition': { duration: 0, delay: 0 },
      'circle-stroke-opacity-transition': { duration: 0, delay: 0 },
    },
  }
}

// La lueur : un disque d'encre flou, sous toutes les marques.
export function calqueLueur(c: CouleursCarte, ecran: number): AddLayerObject {
  return {
    id: CALQUE_LUEUR_NOUVEAUX,
    type: 'circle',
    source: SOURCE,
    filter: estNouveau,
    paint: {
      'circle-color': c.encre,
      'circle-blur': 1, // flou du centre jusqu'au bord : une lueur, pas un disque
      'circle-opacity': 0.6,
      'circle-radius': rayonAuZoom(LUEUR * ecran),
    },
  }
}

// La gélule « NOUVEAU », dessinée d'un bloc avec son mot (sceaux.ts), de près seulement (Uriel, 24/10) :
// de loin, le sceau suffit.
export function calqueGelule(): AddLayerObject {
  return {
    id: CALQUE_GELULE_NOUVEAUX,
    type: 'symbol',
    source: SOURCE,
    minzoom: DE_PRES,
    filter: estNouveau,
    layout: {
      'icon-image': 'gelule-nouveau',
      // Sous la marque, à la place du nom de qui l'a revendiqué (calques.ts ne le montre pas sur un
      // lieu neuf) : jamais les deux empilés.
      'icon-anchor': 'top',
      'icon-offset': [0, 16],
      // Deux lieux neufs voisins : une seule gélule, pour ne pas les empiler (l'anneau reste aux deux).
      'icon-allow-overlap': false,
    },
  }
}

// La lueur sous toutes les marques ; l'anneau au-dessus (sous le lieu survolé), pour qu'aucun voisin
// ne le cache ; la gélule par-dessus tout ; puis l'anneau s'anime.
export function poserNouveaux(map: Carte, c: CouleursCarte, ecran: number): () => void {
  map.addLayer(calqueLueur(c, ecran), 'billes')
  map.addLayer(calqueAnneau(c, ecran), 'survol')
  map.addLayer(calqueGelule())
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
