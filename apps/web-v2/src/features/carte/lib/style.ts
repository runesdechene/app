/**
 * QUOI     — le fond OpenFreeMap habillé en parchemin : fond, eau, routes et textes à l'encre,
 *            forêts en olive pâle, un ombrage de relief léger (spec Carte §2).
 * POURQUOI — une carte médiévale, à plat, qui laisse la place aux lieux : les petites routes,
 *            les bâtiments et les points d'intérêt du fond disparaissent.
 * ATTENTION — fonction pure : le style reçu est copié, jamais modifié. Le terrain 3D n'est pas
 *            posé ici ; il s'allume à l'inclinaison (`relief.ts`).
 */
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl'
import type { CouleursCarte } from './couleurs'

const RETIRES =
  /natural_earth|building|aeroway|poi_|shield|one_way|hatching|road_area|airport|highway-name|pitch|track|cemetery|hospital|school|rail|casing|park_outline|residential|minor|service|path|pedestrian|link|secondary|tertiary|street|waterway_other|waterway_tunnel|label_other|boundary_3/

const TUILES_RELIEF = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'

function habiller(l: LayerSpecification, c: CouleursCarte): LayerSpecification {
  const id = l.id
  if (l.type === 'background') return { ...l, paint: { ...l.paint, 'background-color': c.fond } }
  if (l.type === 'fill') {
    if (id === 'water') return { ...l, paint: { ...l.paint, 'fill-color': c.eau, 'fill-outline-color': c.eau } }
    if (/wood|park/.test(id)) return { ...l, paint: { ...l.paint, 'fill-color': c.foret, 'fill-opacity': 0.28 } }
    if (/grass|wetland|sand|ice/.test(id)) return { ...l, paint: { ...l.paint, 'fill-color': c.fond, 'fill-opacity': 0.3 } }
  }
  if (l.type === 'line') {
    if (/waterway/.test(id)) return { ...l, paint: { ...l.paint, 'line-color': c.eau } }
    if (/motorway|trunk|primary/.test(id)) return { ...l, paint: { ...l.paint, 'line-color': c.route, 'line-opacity': 0.75 } }
    if (/road|bridge|tunnel/.test(id)) return { ...l, paint: { ...l.paint, 'line-color': c.route, 'line-opacity': 0.4 } }
    if (/boundary/.test(id)) return { ...l, paint: { ...l.paint, 'line-color': c.route, 'line-opacity': 0.45 } }
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

export function styleParchemin(style: StyleSpecification, c: CouleursCarte): StyleSpecification {
  const s = structuredClone(style)
  const layers = s.layers.filter((l) => !RETIRES.test(l.id)).map((l) => habiller(l, c))

  // L'ombrage passe sous les routes, les rivières et les limites : il teinte le sol, pas le trait.
  const premiereRoute = layers.findIndex((l) => /road|tunnel|bridge|waterway|boundary/.test(l.id))
  const ombrage: LayerSpecification = {
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
  }
  layers.splice(premiereRoute === -1 ? layers.length : premiereRoute, 0, ombrage)

  return {
    ...s,
    layers,
    sources: {
      ...s.sources,
      relief: { type: 'raster-dem', encoding: 'terrarium', tileSize: 256, maxzoom: 11, tiles: [TUILES_RELIEF] },
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
