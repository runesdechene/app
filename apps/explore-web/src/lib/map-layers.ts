import type { LayerSpecification } from 'maplibre-gl'
import { MAP_COLORS } from './map-style'

// Teinte neutre parchemin appliquée aux territoires quand la Coupe des Héritages est désactivée
const TERRITORY_MUTED_COLOR = '#9E9282'

// --- Layer style : Territoires (construits dynamiquement selon la faction du joueur) ---

export function buildTerritoryFillLayer(userFactionId: string | null, factionColorMode: boolean): LayerSpecification {
  const myFaction = userFactionId ?? ''
  return {
    id: 'territories-fill',
    type: 'fill',
    source: 'territories',
    paint: {
      // Si CdH désactivée OU territoire entièrement fogged : neutre. Sinon : couleur faction.
      'fill-color': factionColorMode
        ? ['case', ['get', 'revealed'], ['get', 'tagColor'], TERRITORY_MUTED_COLOR]
        : TERRITORY_MUTED_COLOR,
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

export function buildTerritoryBorderLayer(factionColorMode: boolean): LayerSpecification {
  return {
    id: 'territories-border',
    type: 'line',
    source: 'territories',
    paint: {
      'line-dasharray': [4, 2],
      'line-color': factionColorMode
        ? ['case', ['get', 'revealed'], ['get', 'tagColor'], TERRITORY_MUTED_COLOR]
        : TERRITORY_MUTED_COLOR,
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

// --- Layer style : Territory labels (symbol layers GPU-side, pas de DOM markers) ---

/** Badge fortification sur les lieux fortifiés (icône bouclier avec chiffre intégré)
 *  NOTE V0.5: gardé pour rétrocompatibilité pendant la transition vers le système d'influence.
 *  Sera supprimé en Phase 6.
 */
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

/** Emblèmes faction au centroïde des territoires (icon + rate intégrés dans l'image)
 *  Caché sur les territoires entièrement fogged pour ne pas leak la faction qui contrôle.
 *  V0.7 : maxzoom=9 — au-delà, le composite avatar+emblème (VeilleMarkers React) prend le
 *  relais avec une taille constante. */
export const territoryEmblemLayer: LayerSpecification = {
  id: 'territory-emblems',
  type: 'symbol',
  source: 'territory-labels',
  maxzoom: 9,
  filter: ['all', ['has', 'pattern'], ['get', 'revealed']],
  layout: {
    'icon-image': ['get', 'pattern'],
    'icon-size': [
      'interpolate', ['linear'], ['zoom'],
      3, 0.08,
      6, 0.12,
      9, 0.20,
    ],
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  },
  paint: {
    'icon-opacity': 1,
  },
}

/** Label territoire au hover (point nord du blob) — caché si territoire entièrement fogged */
export function buildTerritoryHoverLabelLayer(factionColorMode: boolean): LayerSpecification {
  return {
    id: 'territory-hover-labels',
    type: 'symbol',
    source: 'territory-labels',
    filter: ['get', 'revealed'],
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
      'text-color': factionColorMode ? ['get', 'tagColor'] : TERRITORY_MUTED_COLOR,
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
// V0.7 — masqué quand `harvestable: true` (le coffre Couronnes prend la place visuellement)
export const pointLayer: LayerSpecification = {
  id: 'places-point',
  type: 'circle',
  source: 'places',
  filter: ['all',
    ['==', ['get', 'tagIcon'], ''],
    ['==', ['get', 'discovered'], true],
    ['!=', ['get', 'harvestable'], true],
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
// V0.7 — masqué quand `harvestable: true` (le coffre Couronnes prend la place visuellement)
export const iconLayer: LayerSpecification = {
  id: 'places-icon',
  type: 'symbol',
  source: 'places',
  filter: ['all',
    ['!=', ['get', 'tagIcon'], ''],
    ['==', ['get', 'discovered'], true],
    ['!=', ['get', 'harvestable'], true],
  ],
  layout: {
    'icon-image': ['get', 'tagIcon'],
    'icon-size': [
      'interpolate', ['linear'], ['zoom'],
      4, 0.15,
      8, 0.25,
      12, 0.4,
    ],
    'icon-anchor': 'center',
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  },
  paint: {
    'icon-opacity': 1,
  },
}
