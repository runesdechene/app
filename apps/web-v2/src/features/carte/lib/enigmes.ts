/**
 * QUOI     — les énigmes sur la carte : une source, deux calques (des éclats de loin, des sceaux « ? »
 *            de près) et leurs deux images, dessinées au canevas.
 * POURQUOI — maquettes « Énigmes — 1 et 2 » : dézoomée, chaque énigme n'est qu'un éclat, à sa place,
 *            sans regroupement ni chiffre ; à l'échelle d'un pays, le sceau se touche. Tous les sceaux
 *            sont pareils : la culture se découvre au toucher.
 * ATTENTION — la source et les calques se posent tout de suite (le hook peut y verser les données) ;
 *            seules les images attendent la police du « ? ».
 */
import type { FeatureCollection, Point } from 'geojson'
import type { AddLayerObject, Map as Carte, PointLike, SourceSpecification } from 'maplibre-gl'
import type { EnigmeEnAttente } from '../api/lireEnigmes'
import type { CouleursCarte } from '@/shared/lib/couleursCarte'

export const SOURCE_ENIGMES = 'enigmes'
export const CALQUE_ECLATS = 'enigmes-eclats'
export const CALQUE_SCEAUX_ENIGMES = 'enigmes-sceaux'
export const ZOOM_DES_SCEAUX = 6

const RATIO = 2
const ECLAT = 18
const SCEAU = 36

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
  map.addLayer({ id: CALQUE_ECLATS, type: 'symbol', source: SOURCE_ENIGMES, maxzoom: ZOOM_DES_SCEAUX, layout: marque('enigme-eclat') })
  map.addLayer({ id: CALQUE_SCEAUX_ENIGMES, type: 'symbol', source: SOURCE_ENIGMES, minzoom: ZOOM_DES_SCEAUX, layout: marque('enigme-sceau') })
}

function toile(taille: number) {
  const ctx = new OffscreenCanvas(taille * RATIO, taille * RATIO).getContext('2d')
  if (!ctx) throw new Error('canevas indisponible')
  ctx.scale(RATIO, RATIO)
  return ctx
}

// Un point de cire dans un halo pâle.
function eclat(c: CouleursCarte) {
  const ctx = toile(ECLAT)
  const m = ECLAT / 2
  ctx.globalAlpha = 0.2
  ctx.fillStyle = c.cire
  ctx.beginPath()
  ctx.arc(m, m, m, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.beginPath()
  ctx.arc(m, m, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = c.halo
  ctx.stroke()
  return ctx.getImageData(0, 0, ECLAT * RATIO, ECLAT * RATIO)
}

// Le sceau de cire et son « ? » en IM Fell English.
function sceau(c: CouleursCarte) {
  const ctx = toile(SCEAU)
  const m = SCEAU / 2
  ctx.fillStyle = c.cire
  ctx.beginPath()
  ctx.arc(m, m, m - 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = c.halo
  ctx.stroke()
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
}

// Le clic des lieux s'efface devant un sceau d'énigme (même motif que `surUnPin`).
export function surUneEnigme(map: Carte, point: PointLike): boolean {
  return (
    map.getLayer(CALQUE_SCEAUX_ENIGMES) !== undefined &&
    map.queryRenderedFeatures(point, { layers: [CALQUE_SCEAUX_ENIGMES] }).length > 0
  )
}
