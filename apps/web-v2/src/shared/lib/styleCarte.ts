/**
 * QUOI     — le fond OpenFreeMap habillé en parchemin : fond, eau, routes et textes à l'encre,
 *            forêts en olive pâle, un ombrage de relief léger (spec Carte §2).
 * POURQUOI — une carte médiévale, à plat, qui laisse la place aux lieux : les petites routes,
 *            les bâtiments et les points d'intérêt du fond disparaissent.
 * ATTENTION — `styleParchemin` est pure : le style reçu est copié, jamais modifié. Ni l'ombrage
 *            ni le terrain 3D n'y sont posés : l'ombrage vient après les lieux (`ajouterOmbrage`) —
 *            ses tuiles de relief, ~70 Ko chacune, retardaient l'apparition des lieux (Uriel, 02/10 :
 *            « la carte reste très longue à charger ») ; le terrain s'allume à l'inclinaison
 *            (`relief.ts`). Les sources de relief, elles, restent déclarées dans le style.
 */
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl'
import type { CouleursCarte } from './couleursCarte'

const RETIRES =
  /natural_earth|building|aeroway|poi_|shield|one_way|hatching|road_area|airport|highway-name|pitch|track|cemetery|hospital|school|rail|casing|park_outline|residential|minor|service|path|pedestrian|link|secondary|tertiary|street|waterway_other|waterway_tunnel|label_other|boundary_3/

const TUILES_RELIEF = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'

function habiller(l: LayerSpecification, c: CouleursCarte): LayerSpecification {
  const id = l.id
  if (l.type === 'background') return { ...l, paint: { ...l.paint, 'background-color': c.fond } }
  if (l.type === 'fill') {
    if (id === 'water')
      return { ...l, paint: { ...l.paint, 'fill-color': c.eau, 'fill-outline-color': c.eau } }
    if (/wood|park/.test(id))
      return { ...l, paint: { ...l.paint, 'fill-color': c.foret, 'fill-opacity': 0.28 } }
    if (/grass|wetland|sand|ice/.test(id))
      return { ...l, paint: { ...l.paint, 'fill-color': c.fond, 'fill-opacity': 0.3 } }
  }
  if (l.type === 'line') {
    if (/waterway/.test(id)) return { ...l, paint: { ...l.paint, 'line-color': c.eau } }
    if (/motorway|trunk|primary/.test(id))
      return { ...l, paint: { ...l.paint, 'line-color': c.route, 'line-opacity': 0.75 } }
    if (/road|bridge|tunnel/.test(id))
      return { ...l, paint: { ...l.paint, 'line-color': c.route, 'line-opacity': 0.4 } }
    if (/boundary/.test(id))
      return { ...l, paint: { ...l.paint, 'line-color': c.route, 'line-opacity': 0.45 } }
  }
  if (l.type === 'symbol') {
    const italique = /label_(village|town|city)/.test(id)
    return {
      ...l,
      ...(italique && { layout: { ...l.layout, 'text-font': ['Noto Sans Italic'] } }),
      paint: {
        ...l.paint,
        'text-color': c.encre,
        'text-halo-color': c.halo,
        'text-halo-width': 1.6,
        ...(/label_village/.test(id) && { 'text-opacity': 0.7 }),
      },
    }
  }
  return l
}

// Le fond vectoriel (OpenFreeMap), que styleParchemin recolore ; et la France vue d'en haut.
export const FOND = 'https://tiles.openfreemap.org/styles/liberty'
export const FRANCE = { center: [2.4, 46.6] as [number, number], zoom: 5 }

export function styleParchemin(style: StyleSpecification, c: CouleursCarte): StyleSpecification {
  const s = structuredClone(style)
  const layers = s.layers.filter((l) => !RETIRES.test(l.id)).map((l) => habiller(l, c))

  return {
    ...s,
    layers,
    sources: {
      ...s.sources,
      relief: {
        type: 'raster-dem',
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 11,
        tiles: [TUILES_RELIEF],
      },
      // Le terrain 3D a sa propre source : MapLibre déconseille de la partager avec l'ombrage.
      'relief-3d': {
        type: 'raster-dem',
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 11,
        tiles: [TUILES_RELIEF],
      },
    },
    // Incliné, l'horizon se fond dans le parchemin au lieu d'un ciel bleu.
    sky: {
      'sky-color': c.fond,
      'horizon-color': c.halo,
      'fog-color': c.fond,
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.7,
      'fog-ground-blend': 0.5,
    },
  }
}

// Ce dont l'ombrage a besoin d'une carte (la vraie, ou celle des tests).
type CarteOmbrable = {
  getLayer: (id: string) => unknown
  getStyle: () => { layers: { id: string }[] }
  addLayer: (couche: LayerSpecification, avant?: string) => unknown
}

// L'ombrage du relief, posé une fois, sous les routes, les rivières et les limites : il teinte le
// sol, pas le trait.
export function ajouterOmbrage(carte: CarteOmbrable, c: CouleursCarte) {
  if (carte.getLayer('ombrage')) return
  const premiereRoute = carte
    .getStyle()
    .layers.find((l) => /road|tunnel|bridge|waterway|boundary/.test(l.id))
  carte.addLayer(
    {
      id: 'ombrage',
      type: 'hillshade',
      source: 'relief',
      paint: {
        'hillshade-method': 'igor',
        'hillshade-exaggeration': 0.3,
        'hillshade-shadow-color': c.ombre,
        'hillshade-highlight-color': 'transparent',
        'hillshade-accent-color': 'transparent',
        'hillshade-illumination-direction': 315,
      },
    },
    premiereRoute?.id,
  )
}
