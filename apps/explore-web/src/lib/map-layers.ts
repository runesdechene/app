import type { LayerSpecification } from 'maplibre-gl'
import { MAP_COLORS } from './map-style'

// --- Layer style : Territoires (construits dynamiquement selon la faction du joueur) ---

export function buildTerritoryFillLayer(userFactionId: string | null): LayerSpecification {
  const myFaction = userFactionId ?? ''
  return {
    id: 'territories-fill',
    type: 'fill',
    source: 'territories',
    paint: {
      'fill-color': ['get', 'tagColor'],
      'fill-opacity': [
        'case',
        ['==', ['get', 'faction'], myFaction],
        0.25,    // Ma faction
        ['boolean', ['feature-state', 'hover'], false],
        0.30,    // Hover autre faction
        0.18,    // Autre faction
      ],
      'fill-antialias': false,
    },
  }
}

export function buildTerritoryBorderLayer(): LayerSpecification {
  return {
    id: 'territories-border',
    type: 'line',
    source: 'territories',
    paint: {
      'line-dasharray': [4, 2],
      'line-color': ['get', 'tagColor'],
      'line-width': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        3,
        2,
      ],
      'line-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        0.7,
        0.45,
      ],
    },
  }
}

// --- Layer : Pattern de faction en fond de territoire (papier peint) ---

export function buildTerritoryPatternLayer(factionId: string): LayerSpecification {
  return {
    id: `territories-pattern-${factionId}`,
    type: 'fill',
    source: 'territories',
    filter: ['==', ['get', 'faction'], factionId],
    paint: {
      'fill-pattern': `tile::${factionId}`,
      'fill-opacity': 0,  // Désactivé — gardé au cas où
    },
  }
}

// --- Layer : Halos d'influence (cercles flous par lieu, effet aura) ---

export const territoryHaloLayer: LayerSpecification = {
  id: 'territory-halo',
  type: 'circle',
  source: 'places',
  filter: ['all',
    ['==', ['get', 'discovered'], true],
    ['!=', ['get', 'tagColor'], ''],
    ['!=', ['get', 'tagColor'], '#C19A6B'],
  ],
  paint: {
    'circle-color': ['get', 'tagColor'],
    'circle-radius': [
      'interpolate', ['linear'], ['zoom'],
      4, 6,
      7, 15,
      10, 35,
      13, 70,
    ],
    'circle-opacity': [
      'interpolate', ['linear'], ['zoom'],
      4, 0.15,
      8, 0.20,
      12, 0.25,
    ],
    'circle-blur': 1,
    'circle-stroke-width': 0,
  },
}

// --- Layer style : Territory labels (symbol layers GPU-side, pas de DOM markers) ---

/** Badge fortification sur les lieux fortifiés (icône bouclier avec chiffre intégré) */
export const fortBadgeLayer: LayerSpecification = {
  id: 'places-fort-badge',
  type: 'symbol',
  source: 'places',
  minzoom: 8,
  filter: ['>', ['get', 'fortificationLevel'], 0],
  layout: {
    'icon-image': ['concat', 'shield::', ['to-string', ['get', 'fortificationLevel']]],
    'icon-size': [
      'interpolate', ['linear'], ['zoom'],
      6, 0.25,
      9, 0.35,
      12, 0.45,
    ],
    'icon-offset': [38, 38],
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  },
  paint: {
    'icon-opacity': 0.95,
  },
}

/** Emblèmes faction au centroïde des territoires (icon + rate intégrés dans l'image) */
export const territoryEmblemLayer: LayerSpecification = {
  id: 'territory-emblems',
  type: 'symbol',
  source: 'territory-labels',
  filter: ['has', 'pattern'],
  layout: {
    'icon-image': ['get', 'pattern'],
    'icon-size': [
      'interpolate', ['linear'], ['zoom'],
      3, 0.08,
      6, 0.12,
      9, 0.20,
      12, 0.30,
    ],
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  },
  paint: {
    'icon-opacity': 0.7,
  },
}

/** Rate horaire sous la bannière (+X/h) — symbol layer GPU */
export const territoryRateLayer: LayerSpecification = {
  id: 'territory-rates',
  type: 'symbol',
  source: 'territory-labels',
  filter: ['>', ['get', 'hourlyRate'], 0],
  layout: {
    'text-field': ['concat', '+', ['to-string', ['get', 'hourlyRate']], '/h'],
    'text-font': ['Open Sans Bold'],
    'text-size': 11,
    'text-offset': [
      'interpolate', ['linear'], ['zoom'],
      3, ['literal', [0, -1.5]],
      6, ['literal', [0, -2.0]],
      9, ['literal', [0, -3.8]],
      12, ['literal', [0, -5.5]],
    ],
    'text-allow-overlap': true,
    'text-ignore-placement': true,
  },
  paint: {
    'text-color': ['get', 'tagColor'],
    'text-opacity': [
      'interpolate', ['linear'], ['zoom'],
      8, 0,
      9, 0.8,
    ],
    'text-halo-color': MAP_COLORS.land,
    'text-halo-width': 1.5,
  },
}

/** Label territoire au hover (point nord du blob) */
export const territoryHoverLabelLayer: LayerSpecification = {
  id: 'territory-hover-labels',
  type: 'symbol',
  source: 'territory-labels',
  layout: {
    'text-field': [
      'concat',
      ['get', 'factionTitle'],
      '\n',
      ['to-string', ['get', 'placesCount']],
      ['case', ['>', ['get', 'placesCount'], 1], ' lieux', ' lieu'],
    ],
    'text-font': ['Open Sans Bold'],
    'text-size': 11,
    'text-anchor': 'bottom',
    'text-offset': [0, -0.5],
    'text-allow-overlap': true,
    'text-ignore-placement': true,
  },
  paint: {
    'text-color': ['get', 'tagColor'],
    'text-halo-color': 'rgba(255,255,255,0.9)',
    'text-halo-width': 1.5,
    // Invisible par défaut, visible quand hover = true
    'text-opacity': [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      1,
      0,
    ],
  },
}

// --- Layer style : Markers ---

export const UNKNOWN_ICON_ID = '__unknown-place'

// Fallback cercles flous si pas d'icône unknown configurée (caché quand icône dispo)
// S'applique à TOUS les lieux non découverts (y compris faction alliée)
export const undiscoveredCircleLayer: LayerSpecification = {
  id: 'places-undiscovered-circle',
  type: 'circle',
  source: 'places',
  filter: ['==', ['get', 'discovered'], false],
  paint: {
    'circle-color': '#8A7B6A',
    'circle-radius': [
      'interpolate', ['linear'], ['zoom'],
      4, 4,
      8, 6,
      12, 9,
    ],
    'circle-stroke-width': 0,
    'circle-opacity': 0.6,
    'circle-blur': 1,
  },
}

// Icône custom pour les lieux non découverts (visible quand icône chargée)
// S'applique à TOUS les lieux non découverts (y compris faction alliée)
export const undiscoveredIconLayer: LayerSpecification = {
  id: 'places-undiscovered-icon',
  type: 'symbol',
  source: 'places',
  filter: ['==', ['get', 'discovered'], false],
  layout: {
    'icon-image': UNKNOWN_ICON_ID,
    'icon-size': [
      'interpolate', ['linear'], ['zoom'],
      4, 0.25,
      8, 0.35,
      12, 0.5,
    ],
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  },
  paint: {
    'icon-opacity': 0.8,
  },
}

// Cercles colorés nets — lieux découverts SANS icône
export const pointLayer: LayerSpecification = {
  id: 'places-point',
  type: 'circle',
  source: 'places',
  filter: ['all',
    ['==', ['get', 'tagIcon'], ''],
    ['==', ['get', 'discovered'], true],
  ],
  paint: {
    'circle-color': ['get', 'iconColor'],
    'circle-radius': [
      'interpolate', ['linear'], ['zoom'],
      4, 3,
      8, 5,
      12, 7,
    ],
    'circle-stroke-width': 1.5,
    'circle-stroke-color': MAP_COLORS.land,
    'circle-opacity': 1,
    'circle-blur': 0,
  },
}

// Icônes SVG colorées — lieux découverts avec icône
export const iconLayer: LayerSpecification = {
  id: 'places-icon',
  type: 'symbol',
  source: 'places',
  filter: ['all',
    ['!=', ['get', 'tagIcon'], ''],
    ['==', ['get', 'discovered'], true],
  ],
  layout: {
    'icon-image': ['get', 'tagIcon'],
    'icon-size': [
      'interpolate', ['linear'], ['zoom'],
      4, 0.15,
      8, 0.25,
      12, 0.4,
    ],
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  },
  paint: {
    'icon-opacity': 1,
  },
}
