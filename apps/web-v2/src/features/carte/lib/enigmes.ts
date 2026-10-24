/**
 * QUOI     — les énigmes sur la carte : une source, le calque des sceaux et leurs images (le sceau de
 *            cire à la clé d'or dessiné par Uriel, la cire teinte à la couleur de la culture) ;
 *            dessous, une onde de la même couleur qui rayonne.
 * POURQUOI — le même sceau à tous les zooms, qu'on touche même dézoomé : les éclats de loin ne
 *            donnaient pas envie d'aller voir (Uriel, 07/10). Sans regroupement ni chiffre. Vert pour
 *            les Celtes, bleu pour les Nordiques… (Uriel, 24/10 : la place trahit déjà la culture).
 * ATTENTION — la source et les calques se posent tout de suite ; les images d'une couleur se dessinent
 *            une fois, avant que le hook verse les énigmes qui la portent (`ajouterSceaux`).
 */
import type { FeatureCollection, Point } from 'geojson'
import type {
  AddLayerObject,
  ExpressionSpecification,
  FilterSpecification,
  Map as Carte,
  PointLike,
  SourceSpecification,
} from 'maplibre-gl'
import type { EnigmeEnAttente } from '../api/lireEnigmes'
import type { CouleursCarte } from '@/shared/lib/couleursCarte'
import imageCire from '@/assets/ui/enigme-cire.png'
import imageCle from '@/assets/ui/enigme-cle.png'

export const SOURCE_ENIGMES = 'enigmes'
export const CALQUE_ONDES_ENIGMES = 'enigmes-ondes'
export const CALQUE_SCEAUX_ENIGMES = 'enigmes-sceaux'

const RATIO = 2
const SCEAU = 36
const PERIODE = 2200 // ms : une onde par battement, lente, pour appeler sans agacer

// Où en est l'onde à la phase `t` (0 → 1) : `part` de son élargissement, et son opacité qui
// s'éteint en chemin.
export function onde(t: number): { part: number; opacite: number } {
  return { part: t, opacite: 0.5 * (1 - t) ** 2 }
}

// Le nom de l'image d'un sceau : une par couleur de culture ; sans couleur, la cire d'origine.
export function nomDuSceau(couleur: string | null): string {
  return couleur === null ? 'enigme' : `enigme-${couleur}`
}

export function enGeoJSONEnigmes(
  enigmes: EnigmeEnAttente[],
): FeatureCollection<Point, { id: number; image: string; couleur: string | null }> {
  return {
    type: 'FeatureCollection',
    features: enigmes.map((e) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [e.lng, e.lat] },
      properties: { id: e.id, image: nomDuSceau(e.couleur), couleur: e.couleur },
    })),
  }
}

// Dézoomé, le sceau est tout petit (40 %) ; il atteint sa taille à l'échelle d'un pays (Uriel, 07/10).
// `ecran` : le facteur de la taille d'écran. L'onde suit la même échelle.
const PETIT = 0.4
export function tailleDuSceau(ecran: number): ExpressionSpecification {
  return ['interpolate', ['linear'], ['zoom'], 3, PETIT * ecran, 6, ecran]
}

type SupportDeCalques = {
  addSource: (id: string, source: SourceSpecification) => void
  addLayer: (calque: AddLayerObject) => void
}

export function ajouterCalquesEnigmes(map: SupportDeCalques, ecran: number) {
  map.addSource(SOURCE_ENIGMES, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  // L'onde, sous les sceaux : un cercle de cire dont `fairePulser` fait varier le rayon et l'opacité.
  map.addLayer({
    id: CALQUE_ONDES_ENIGMES,
    type: 'circle',
    source: SOURCE_ENIGMES,
    paint: {
      'circle-color': 'transparent',
      'circle-radius': 0,
      'circle-opacity': 0,
      // Pas de fondu : on change ces valeurs à chaque image (sinon les fondus se chevauchent et saccadent).
      'circle-radius-transition': { duration: 0, delay: 0 },
      'circle-opacity-transition': { duration: 0, delay: 0 },
    },
  })
  map.addLayer({
    id: CALQUE_SCEAUX_ENIGMES,
    type: 'symbol',
    source: SOURCE_ENIGMES,
    layout: {
      'icon-image': ['get', 'image'],
      'icon-size': tailleDuSceau(ecran),
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  })
}

// OffscreenCanvas manque sur iOS avant 16.4 : un canevas ordinaire, jamais affiché, le remplace
// (même repli que `contexte2d` des pins).
export function toileDesEnigmes(taille: number) {
  const cote = taille * RATIO
  const ctx =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(cote, cote).getContext('2d')
      : Object.assign(document.createElement('canvas'), { width: cote, height: cote }).getContext(
          '2d',
        )
  if (!ctx) throw new Error('canevas indisponible')
  ctx.scale(RATIO, RATIO)
  return ctx
}

// Les deux calques du sceau d'Uriel (24/10), à la même taille : la cire, puis la clé d'or. Chargés une
// fois pour toute la session.
let calques: Promise<[HTMLImageElement, HTMLImageElement]> | null = null
function chargerCalques() {
  const charger = async (src: string) => {
    const image = new Image()
    image.src = src
    await image.decode()
    return image
  }
  calques ??= Promise.all([charger(imageCire), charger(imageCle)])
  return calques
}

// La cire prend la teinte de la culture et garde ses ombres (mode « color ») ; la clé reste d'or.
function sceau(cire: HTMLImageElement, cle: HTMLImageElement, couleur: string | null) {
  const ctx = toileDesEnigmes(SCEAU)
  ctx.drawImage(cire, 0, 0, SCEAU, SCEAU)
  if (couleur !== null) {
    ctx.globalCompositeOperation = 'color'
    ctx.fillStyle = couleur
    ctx.fillRect(0, 0, SCEAU, SCEAU)
    // La teinte a débordé sur le transparent : on ne garde que la forme de la cire.
    ctx.globalCompositeOperation = 'destination-in'
    ctx.drawImage(cire, 0, 0, SCEAU, SCEAU)
    ctx.globalCompositeOperation = 'source-over'
  }
  ctx.drawImage(cle, 0, 0, SCEAU, SCEAU)
  return ctx.getImageData(0, 0, SCEAU * RATIO, SCEAU * RATIO)
}

// Les sceaux des couleurs demandées, ceux qui manquent seulement.
export async function ajouterSceaux(map: Carte, couleurs: (string | null)[]): Promise<void> {
  const [cire, cle] = await chargerCalques()
  for (const couleur of new Set(couleurs)) {
    const nom = nomDuSceau(couleur)
    if (!map.hasImage(nom)) map.addImage(nom, sceau(cire, cle, couleur), { pixelRatio: RATIO })
  }
}

export function poserEnigmes(map: Carte, c: CouleursCarte, ecran: number) {
  ajouterCalquesEnigmes(map, ecran)
  fairePulser(map, c.cire, ecran)
}

// Les énigmes rayonnent (Uriel, 07/10) : une onde part de chaque sceau, s'élargit et s'efface, en
// boucle. Le rayon d'un cercle s'anime image par image (comme le survol, `survol.ts`). Animations
// réduites : pas d'onde.
export function fairePulser(map: Carte, cire: string, ecran: number): () => void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => undefined
  // L'onde de la couleur de la culture ; la cire d'origine, sinon.
  map.setPaintProperty(CALQUE_ONDES_ENIGMES, 'circle-color', ['coalesce', ['get', 'couleur'], cire])
  let image = 0
  const pas = (maintenant: number) => {
    if (!map.getLayer(CALQUE_ONDES_ENIGMES)) return
    const { part, opacite } = onde((maintenant % PERIODE) / PERIODE)
    const rayon = (16 + part * 16) * ecran
    map.setPaintProperty(CALQUE_ONDES_ENIGMES, 'circle-radius', [
      'interpolate',
      ['linear'],
      ['zoom'],
      3,
      PETIT * rayon,
      6,
      rayon,
    ])
    map.setPaintProperty(CALQUE_ONDES_ENIGMES, 'circle-opacity', opacite)
    image = requestAnimationFrame(pas)
  }
  image = requestAnimationFrame(pas)
  return () => {
    cancelAnimationFrame(image)
  }
}

export const CALQUES_ENIGMES = [CALQUE_ONDES_ENIGMES, CALQUE_SCEAUX_ENIGMES]

// L'énigme touchée quitte la carte le temps que son sceau se retourne par-dessus : on ne doit voir
// qu'un sceau, celui qui pivote (Uriel, 07/10).
export function sansLEnigme(id: number | null): FilterSpecification | null {
  return id === null ? null : ['!=', ['get', 'id'], id]
}

// Le clic des lieux s'efface devant un sceau d'énigme (même motif que `surUnPin`).
export function surUneEnigme(map: Carte, point: PointLike): boolean {
  return (
    map.getLayer(CALQUE_SCEAUX_ENIGMES) !== undefined &&
    map.queryRenderedFeatures(point, { layers: [CALQUE_SCEAUX_ENIGMES] }).length > 0
  )
}
