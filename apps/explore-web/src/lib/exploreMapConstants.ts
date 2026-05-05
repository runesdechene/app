// Constantes & types partagés du composant ExploreMap.
// Extraits dans le sprint Purification (B17, mai 2026).

// Couleurs du mode "Coupe des Héritages" — fond parchemin, lieux en encre brune.
// La couleur faction n'apparaît plus sur les lieux : seule la bannière d'emblème
// territoire la porte.
export const HERITAGE_CUP_DOT_COLOR = '#ecdfc0'  // Parchemin clair, fond très lumineux
export const HERITAGE_CUP_INK_COLOR = '#2D1F0F'  // Encre brune foncée pour les icônes
export const HERITAGE_CUP_INK_PREFIX = 'ink::'

export const MAP_STYLE_PROP = { width: '100%', height: '100%' } as const
export const MAP_CONTAINER_STYLE = { position: 'relative' as const, width: '100%', height: '100%' }
export const INITIAL_VIEW = { longitude: 2.45, latitude: 46.6, zoom: 6 }

export interface PopupInfo {
  id: string
  longitude: number
  latitude: number
  title: string
  tagTitle: string
  tagColor: string
}
