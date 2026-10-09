/**
 * QUOI     — les énigmes sur la carte : une source, le calque des sceaux « ? » et son image, dessinée
 *            au canevas ; dessous, une onde qui rayonne.
 * POURQUOI — le même sceau à tous les zooms, qu'on touche même dézoomé : les éclats de loin ne
 *            donnaient pas envie d'aller voir (Uriel, 07/10). Sans regroupement ni chiffre. Tous les
 *            sceaux sont pareils : la culture se découvre au toucher.
 * ATTENTION — la source et les calques se posent tout de suite (le hook peut y verser les données) ;
 *            seule l'image attend la police du « ? ».
 */
import type { FeatureCollection, Point } from 'geojson'
import type { AddLayerObject, ExpressionSpecification, FilterSpecification, Map as Carte, PointLike, SourceSpecification } from 'maplibre-gl'
import type { EnigmeEnAttente } from '../api/lireEnigmes'
import type { CouleursCarte } from '@/shared/lib/couleursCarte'
import { BORD_DE_CIRE } from './cachet'

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

export function enGeoJSONEnigmes(enigmes: EnigmeEnAttente[]): FeatureCollection<Point, { id: number }> {
  return {
    type: 'FeatureCollection',
    features: enigmes.map((e) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [e.lng, e.lat] },
      properties: { id: e.id },
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
  map.addSource(SOURCE_ENIGMES, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
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
      'icon-image': 'enigme-sceau',
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
      : Object.assign(document.createElement('canvas'), { width: cote, height: cote }).getContext('2d')
  if (!ctx) throw new Error('canevas indisponible')
  ctx.scale(RATIO, RATIO)
  return ctx
}

// Le sceau de cire et son « ? » en IM Fell English : le même bord irrégulier que le cachet qui se
// retourne au toucher (Uriel, 07/10), dessiné dans le repère 96 × 96 de `BORD_DE_CIRE`.
function sceau(c: CouleursCarte) {
  const ctx = toileDesEnigmes(SCEAU)
  const m = SCEAU / 2
  ctx.save()
  ctx.scale(SCEAU / 96, SCEAU / 96)
  const bord = new Path2D(BORD_DE_CIRE)
  ctx.fillStyle = c.cire
  ctx.fill(bord)
  ctx.lineWidth = 5
  ctx.strokeStyle = c.halo
  ctx.stroke(bord)
  ctx.restore()
  ctx.fillStyle = c.halo
  ctx.font = 'italic 24px "IM Fell English"'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('?', m, m + 1)
  return ctx.getImageData(0, 0, SCEAU * RATIO, SCEAU * RATIO)
}

export async function poserEnigmes(map: Carte, c: CouleursCarte, ecran: number): Promise<void> {
  ajouterCalquesEnigmes(map, ecran)
  await document.fonts.load('italic 24px "IM Fell English"')
  if (!map.hasImage('enigme-sceau')) map.addImage('enigme-sceau', sceau(c), { pixelRatio: RATIO })
  fairePulser(map, c.cire, ecran)
}

// Les énigmes rayonnent (Uriel, 07/10) : une onde part de chaque sceau, s'élargit et s'efface, en
// boucle. Le rayon d'un cercle s'anime image par image (comme le survol, `survol.ts`). Animations
// réduites : pas d'onde.
export function fairePulser(map: Carte, couleur: string, ecran: number): () => void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => undefined
  map.setPaintProperty(CALQUE_ONDES_ENIGMES, 'circle-color', couleur)
  let image = 0
  const pas = (maintenant: number) => {
    if (!map.getLayer(CALQUE_ONDES_ENIGMES)) return
    const { part, opacite } = onde((maintenant % PERIODE) / PERIODE)
    const rayon = (16 + part * 16) * ecran
    map.setPaintProperty(CALQUE_ONDES_ENIGMES, 'circle-radius', ['interpolate', ['linear'], ['zoom'], 3, PETIT * rayon, 6, rayon])
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
