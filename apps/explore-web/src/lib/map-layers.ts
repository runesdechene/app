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
        0.28,    // Ma faction : bien visible
        ['boolean', ['feature-state', 'hover'], false],
        0.30,    // Hover autre faction
        0.18,    // Autre faction : standard
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
      // 2 base + 0.3 par lieu (cap 10 lieux → max 5), hover 4.5
      'line-width': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        4.5,
        ['+', 2, ['*', ['min', ['get', 'placesCount'], 10], 0.3]],
      ],
      'line-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        0.8,
        ['min', ['+', 0.4, ['*', ['min', ['get', 'placesCount'], 10], 0.03]], 0.7],
      ],
    },
  }
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
