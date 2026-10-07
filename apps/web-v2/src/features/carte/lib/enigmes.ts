/**
 * QUOI     — les énigmes sur la carte : une source, deux calques (des éclats de loin, des sceaux « ? »
 *            de près) et leurs deux images, dessinées au canevas ; dessous, une onde qui rayonne.
 * POURQUOI — maquettes « Énigmes — 1 et 2 » : dézoomée, chaque énigme n'est qu'un éclat, à sa place,
 *            sans regroupement ni chiffre ; à l'échelle d'un pays, le sceau se touche. Tous les sceaux
 *            sont pareils : la culture se découvre au toucher.
 * ATTENTION — la source et les calques se posent tout de suite (le hook peut y verser les données) ;
 *            seules les images attendent la police du « ? ».
 */
import type { FeatureCollection, Point } from 'geojson'
import type { AddLayerObject, FilterSpecification, Map as Carte, PointLike, SourceSpecification } from 'maplibre-gl'
import type { EnigmeEnAttente } from '../api/lireEnigmes'
import type { CouleursCarte } from '@/shared/lib/couleursCarte'
import { BORD_DE_CIRE } from './cachet'

export const SOURCE_ENIGMES = 'enigmes'
export const CALQUE_ONDES_ENIGMES = 'enigmes-ondes'
export const CALQUE_ECLATS = 'enigmes-eclats'
export const CALQUE_SCEAUX_ENIGMES = 'enigmes-sceaux'
export const ZOOM_DES_SCEAUX = 6

const RATIO = 2
const ECLAT = 30
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

type SupportDeCalques = {
  addSource: (id: string, source: SourceSpecification) => void
  addLayer: (calque: AddLayerObject) => void
}

export function ajouterCalquesEnigmes(map: SupportDeCalques, ecran: number) {
  map.addSource(SOURCE_ENIGMES, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  const marque = (image: string) => ({
    'icon-image': image,
    'icon-size': ecran,
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  })
  // L'onde, sous les marques : un cercle de cire dont `fairePulser` fait varier le rayon et l'opacité.
  map.addLayer({
    id: CALQUE_ONDES_ENIGMES,
    type: 'circle',
    source: SOURCE_ENIGMES,
    paint: { 'circle-color': 'transparent', 'circle-radius': 0, 'circle-opacity': 0 },
  })
  map.addLayer({ id: CALQUE_ECLATS, type: 'symbol', source: SOURCE_ENIGMES, maxzoom: ZOOM_DES_SCEAUX, layout: marque('enigme-eclat') })
  map.addLayer({ id: CALQUE_SCEAUX_ENIGMES, type: 'symbol', source: SOURCE_ENIGMES, minzoom: ZOOM_DES_SCEAUX, layout: marque('enigme-sceau') })
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

// Un point de cire cerclé de crème, dans deux halos : il doit se voir dézoomé, entre les lieux
// (Uriel, 07/10 : « plus visible au dézoom »).
function eclat(c: CouleursCarte) {
  const ctx = toileDesEnigmes(ECLAT)
  const m = ECLAT / 2
  ctx.fillStyle = c.cire
  for (const [rayon, opacite] of [[m, 0.18], [m * 0.62, 0.32]] as const) {
    ctx.globalAlpha = opacite
    ctx.beginPath()
    ctx.arc(m, m, rayon, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.beginPath()
  ctx.arc(m, m, 5.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = c.halo
  ctx.stroke()
  return ctx.getImageData(0, 0, ECLAT * RATIO, ECLAT * RATIO)
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
  if (!map.hasImage('enigme-eclat')) map.addImage('enigme-eclat', eclat(c), { pixelRatio: RATIO })
  if (!map.hasImage('enigme-sceau')) map.addImage('enigme-sceau', sceau(c), { pixelRatio: RATIO })
  fairePulser(map, c.cire, ecran)
}

// Les énigmes rayonnent (Uriel, 07/10) : une onde part de chaque marque, s'élargit et s'efface, en
// boucle. Le rayon d'un cercle s'anime image par image (comme le survol, `survol.ts`) ; il suit le
// zoom : de la taille de l'éclat de loin, du sceau de près. Animations réduites : pas d'onde.
export function fairePulser(map: Carte, couleur: string, ecran: number): () => void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => undefined
  map.setPaintProperty(CALQUE_ONDES_ENIGMES, 'circle-color', couleur)
  let image = 0
  const pas = (maintenant: number) => {
    if (!map.getLayer(CALQUE_ONDES_ENIGMES)) return
    const { part, opacite } = onde((maintenant % PERIODE) / PERIODE)
    const eclat = (5 + part * 14) * ecran
    const sceau = (16 + part * 16) * ecran
    map.setPaintProperty(CALQUE_ONDES_ENIGMES, 'circle-radius', ['step', ['zoom'], eclat, ZOOM_DES_SCEAUX, sceau])
    map.setPaintProperty(CALQUE_ONDES_ENIGMES, 'circle-opacity', opacite)
    image = requestAnimationFrame(pas)
  }
  image = requestAnimationFrame(pas)
  return () => {
    cancelAnimationFrame(image)
  }
}

export const CALQUES_ENIGMES = [CALQUE_ONDES_ENIGMES, CALQUE_ECLATS, CALQUE_SCEAUX_ENIGMES]

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
