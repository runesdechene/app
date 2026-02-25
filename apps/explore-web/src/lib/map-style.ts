import type { StyleSpecification, LayerSpecification } from 'maplibre-gl'

// ============================================================
// PALETTE CARTE — Modifier ici pour changer le style de la carte
// ============================================================
export const MAP_COLORS = {
  // Terrain
  land:           '#F5E6D3',   // Fond / terre
  landResidential:'#EDE0CE',   // Zones résidentielles
  park:           '#E2D8C4',   // Parcs, jardins
  wood:           '#ecddbd',   // Forêts
  glacier:        '#F0EBE0',   // Glaciers, neige

  // Eau
  water:          '#cec4b8',   // Océans, lacs
  waterway:       'transparent',   // Rivières, canaux
  waterLabel:     '#7D6B5A',   // Labels cours d'eau

  // Bâtiments
  building:       '#E8D5BE',   // Remplissage bâtiments
  buildingOutline:'#D4C4A8',   // Contour bâtiments

  // Routes
  roadMajor:      '#EDE0CE',   // Routes principales (intérieur)
  roadMajorCasing:'#C8B8A0',   // Routes principales (contour)
  roadMinor:      '#D4C4A8',   // Routes secondaires
  roadPath:       '#D4C4A8',   // Chemins, sentiers
  roadSubtle:     'rgba(160,120,76,0.4)', // Routes subtiles (dézoom)
  railway:        '#C8B8A0',   // Voies ferrées
  railwayDash:    '#F0E4D0',   // Tirets voies ferrées

  // Frontières
  boundary:       '#A0784C',   // Frontières

  // Labels
  labelDark:      '#4A3728',   // Villes capitales, grandes villes
  labelMedium:    '#5C4A3A',   // Villes moyennes, états
  labelLight:     '#7D6B5A',   // Routes, aéroports, petits labels
  labelSubtle:    '#8A7B6A',   // Chemins, cours d'eau
  labelHalo:      '#F5E6D3',   // Halo derrière les labels
  labelHaloAlpha: 'rgba(245,230,211,0.7)', // Halo transparent
} as const

// ============================================================

// Layers cachés en mode jeu (carte épurée)
const GAME_HIDDEN_PATTERNS = [
  /housenumber/i,
  /poi/i,
  /aeroway/i,
  /road/i,
  /transportation/i,
  /motorway/i,
  /trunk/i,
  /primary/i,
  /railway/i,
  /building/i,
  /ferry/i,
  /tunnel/i,
  /bridge/i,
  /shield/i,
  /highway/i,
]

/** Recolore un style Positron avec la palette parchemin */
function applyParchmentColors(style: StyleSpecification, dimLabels: boolean): void {
  const c = MAP_COLORS

  const colorMap: Record<string, string> = {
    'rgb(242,243,240)':       c.land,
    'rgb(194, 200, 202)':     c.water,
    'rgb(230, 233, 229)':     c.park,
    'rgb(220,224,220)':       c.wood,
    'rgb(234, 234, 229)':     c.building,
    'rgb(219, 219, 218)':     c.buildingOutline,
    'rgb(234, 234, 230)':     c.landResidential,
    'rgb(213, 213, 213)':     c.roadMajorCasing,
    'rgb(234,234,234)':       c.roadMinor,
    'rgb(234, 234, 234)':     c.roadPath,
    'hsl(0,0%,88%)':          c.roadMinor,
    '#dddddd':                c.railway,
    '#fafafa':                c.railwayDash,
    'hsl(195,17%,78%)':       c.waterway,
    'hsl(0,0%,70%)':          c.boundary,
    'hsla(0,0%,85%,0.69)':    c.roadSubtle,
  }

  const labelColorMap: Record<string, string> = {
    '#000':        c.labelDark,
    '#000000':     c.labelDark,
    '#333':        c.labelMedium,
    '#333333':     c.labelMedium,
    '#666':        c.labelLight,
    '#666666':     c.labelLight,
    '#495e91':     c.waterLabel,
    'hsl(0,0%,66%)': c.labelSubtle,
    'hsl(30,0%,62%)': c.labelSubtle,
  }

  const haloMap: Record<string, string> = {
    '#fff':                     c.labelHalo,
    '#ffffff':                  c.labelHalo,
    'rgba(255,255,255,0.7)':    c.labelHaloAlpha,
    '#f8f4f0':                  c.labelHalo,
  }

  for (const layer of style.layers as LayerSpecification[]) {
    const paint = (layer as Record<string, unknown>).paint as Record<string, unknown> | undefined
    if (!paint) continue

    for (const [key, value] of Object.entries(paint)) {
      if (typeof value !== 'string') continue

      if (colorMap[value]) {
        paint[key] = colorMap[value]
      }

      if (value === '#fff' && (key === 'line-color' || key === 'fill-color')) {
        paint[key] = c.roadMajor
      }
      if (value === 'rgba(255, 255, 255, 1)') {
        paint[key] = c.roadMajor
      }
    }

    if (typeof paint['text-color'] === 'string' && labelColorMap[paint['text-color'] as string]) {
      paint['text-color'] = labelColorMap[paint['text-color'] as string]
    }

    if (typeof paint['text-halo-color'] === 'string' && haloMap[paint['text-halo-color'] as string]) {
      paint['text-halo-color'] = haloMap[paint['text-halo-color'] as string]
    }

    if (dimLabels && layer.type === 'symbol' && paint['text-color']) {
      paint['text-opacity'] = 0.5
    }
  }
}

/**
 * Style parchemin de JEU — épuré (pas de routes, bâtiments, POIs).
 */
export async function loadParchmentStyle(): Promise<StyleSpecification> {
  const res = await fetch('https://tiles.openfreemap.org/styles/positron')
  const style: StyleSpecification = await res.json()

  // Supprimer les layers de détail pour la carte de jeu
  style.layers = (style.layers as LayerSpecification[]).filter(layer => {
    const id = layer.id.toLowerCase()
    return !GAME_HIDDEN_PATTERNS.some(p => p.test(id))
  })

  applyParchmentColors(style, true)
  return style
}

/**
 * Style parchemin DÉTAILLÉ — routes, bâtiments, POIs visibles (pour placement précis).
 */
export async function loadParchmentDetailedStyle(): Promise<StyleSpecification> {
  const res = await fetch('https://tiles.openfreemap.org/styles/positron')
  const style: StyleSpecification = await res.json()

  // On garde TOUS les layers — pas de filtre
  applyParchmentColors(style, false)
  return style
}

/**
 * Style satellite avec tuiles Esri World Imagery (gratuites, pas de clé API).
 * Labels de villes superposés via OpenFreeMap Positron (layer symbol uniquement).
 */
export async function loadSatelliteStyle(): Promise<StyleSpecification> {
  const res = await fetch('https://tiles.openfreemap.org/styles/positron')
  const positron: StyleSpecification = await res.json()

  const labelLayers = (positron.layers as LayerSpecification[]).filter(
    l => l.type === 'symbol',
  )

  for (const layer of labelLayers) {
    const paint = (layer as Record<string, unknown>).paint as Record<string, unknown> | undefined
    if (!paint) continue
    paint['text-color'] = '#ffffff'
    paint['text-halo-color'] = 'rgba(0,0,0,0.7)'
    paint['text-halo-width'] = 1.5
    paint['text-opacity'] = 1
  }

  return {
    version: 8,
    name: 'satellite',
    sources: {
      ...positron.sources,
      'esri-satellite': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Esri, Maxar, Earthstar Geographics',
      },
    },
    layers: [
      {
        id: 'satellite-tiles',
        type: 'raster',
        source: 'esri-satellite',
        minzoom: 0,
        maxzoom: 19,
      } as LayerSpecification,
      ...labelLayers,
    ],
  }
}
