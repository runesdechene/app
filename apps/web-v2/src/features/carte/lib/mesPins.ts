/**
 * QUOI     — mes pins sur ma carte (maquette « Pin GPS — 4 ») : un rond crème bordé d'accent, l'icône
 *            du pin au centre, ses jours dessous ; visibles de moi seul (mes_pins ne renvoie que les
 *            miens).
 * POURQUOI — Uriel, 06/10 : retrouver ses pins aussi sur la carte. Un toucher ouvre la petite
 *            carte du pin (l'app câble le toucher).
 * ATTENTION — la zone carte ne connaît pas la zone pin : `MonPin` est un type à elle, et l'app ne
 *            lui passe que les pins envoyés (ceux en attente n'ont pas encore de fiche).
 *            Dessin en pixelRatio 2 (88 px = 44 px à l'écran). La couche se pose à chaque
 *            `style.load` mais une seule fois ; l'image arrive quand l'icône est chargée.
 */
import type { FeatureCollection, Point as PointGeo } from 'geojson'
import type { Map as Carte, PointLike } from 'maplibre-gl'
import pinGps from '@/assets/ui/pin-gps.svg'
import type { Point } from '@/shared/lib/distance'
import type { CouleursCarte } from '@/shared/lib/couleursCarte'

export const MES_PINS = 'mes-pins'

export type MonPin = { id: string; point: Point; jours: number }

// Ce que la carte reçoit de l'app : mes pins, le toucher, et le pin sur lequel se centrer
// (« Voir sur la carte ») avec de quoi dire qu'on s'y est rendu.
export type PinsDeLaCarte = {
  mesPins?: MonPin[] | undefined
  onToucherPin?: ((id: string) => void) | undefined
  centrerSur?: Point | undefined
  onCentre?: (() => void) | undefined
}

const TAILLE = 88
const ICONE = 48
const RATIO = 2

export function enGeoJSONPins(
  pins: MonPin[],
): FeatureCollection<PointGeo, { id: string; jours: string }> {
  return {
    type: 'FeatureCollection',
    features: pins.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.point.longitude, p.point.latitude] },
      properties: { id: p.id, jours: `${String(Math.max(p.jours, 0))} j` },
    })),
  }
}

// Le point touché est-il sur un de mes pins ? (le clic d'un lieu dessous s'efface alors)
export function surUnPin(map: Carte, point: PointLike): boolean {
  return (
    map.getLayer(MES_PINS) !== undefined &&
    map.queryRenderedFeatures(point, { layers: [MES_PINS] }).length > 0
  )
}

function chargerIcone(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      resolve(image)
    }
    image.onerror = reject
    image.src = pinGps
  })
}

function dessinerPin(icone: HTMLImageElement | null, c: CouleursCarte, accent: string) {
  const ctx = new OffscreenCanvas(TAILLE, TAILLE).getContext('2d')
  if (!ctx) throw new Error('canevas indisponible')
  ctx.beginPath()
  ctx.arc(TAILLE / 2, TAILLE / 2, TAILLE / 2 - 3, 0, Math.PI * 2)
  ctx.fillStyle = c.halo
  ctx.fill()
  ctx.lineWidth = 5
  ctx.strokeStyle = accent
  ctx.stroke()
  if (icone) ctx.drawImage(icone, (TAILLE - ICONE) / 2, (TAILLE - ICONE) / 2, ICONE, ICONE)
  return ctx.getImageData(0, 0, TAILLE, TAILLE)
}

// La source et le calque tout de suite (vides : `setData` peut venir sans attendre), l'image dès
// que l'icône est chargée. Idempotent : `style.load` peut revenir.
export async function poserMesPins(map: Carte, c: CouleursCarte): Promise<void> {
  if (!map.getLayer(MES_PINS)) {
    map.addSource(MES_PINS, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addLayer({
      id: MES_PINS,
      type: 'symbol',
      source: MES_PINS,
      layout: {
        'icon-image': MES_PINS,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'text-field': ['get', 'jours'],
        'text-font': ['Noto Sans Bold'], // celle des pilules (calques.ts)
        'text-size': 10,
        'text-offset': [0, 1.9],
        'text-allow-overlap': true,
      },
      paint: { 'text-color': c.halo, 'text-halo-color': c.encre, 'text-halo-width': 2 },
    })
  }
  if (map.hasImage(MES_PINS)) return
  // Sans icône (elle ne se charge pas), le rond reste : jamais une image manquante.
  const icone = await chargerIcone().catch(() => null)
  const accent = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-accent')
    .trim()
  if (!map.hasImage(MES_PINS)) {
    map.addImage(MES_PINS, dessinerPin(icone, c, accent || c.encre), { pixelRatio: RATIO })
  }
}
