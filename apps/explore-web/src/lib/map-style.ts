import type { StyleSpecification, LayerSpecification } from 'maplibre-gl'

// ============================================================
// PALETTE CARTE — Modifier ici pour changer le style de la carte
// ============================================================
export const MAP_COLORS = {
  // Terrain
  land:           '#F5E6D3',   // Fond / terre
  landResidential:'#EDE0CE',   // Zones résidentielles
  park:           '#E2D8C4',   // Parcs, jardins
  wood:           '#DDD4C0',   // Forêts
  glacier:        '#F0EBE0',   // Glaciers, neige

  // Eau
  water:          '#C4B8A0',   // Océans, lacs
  waterway:       '#B8A890',   // Rivières, canaux
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

/**
 * Charge le style Positron d'OpenFreeMap et remplace les couleurs
 * par la palette parchemin ci-dessus.
 */
export async function loadParchmentStyle(): Promise<StyleSpecification> {
  const res = await fetch('https://tiles.openfreemap.org/styles/positron')
  const style: StyleSpecification = await res.json()
  const c = MAP_COLORS

  // Mapping : couleur originale Positron → couleur parchemin
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

      // Blanc pur → teinte parchemin
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
  }

  return style
}
