// Set de glyphes historiques pour les bannières de Compagnie.
// Monochromes (currentColor), viewBox 0 0 24 24. Le rendu (couleur/filtre) est géré
// par <CompanyEmblem>. Ajouter un glyphe = une entrée ici, rien d'autre à toucher.

import type { ReactNode } from 'react'

export interface CompanyGlyph {
  slug: string
  label: string
  node: ReactNode
}

// Helpers de style — trait pour les line-icons, remplissage pour les pleins.
const S = {
  fill: { fill: 'currentColor' },
  line: {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  },
}

export const COMPANY_GLYPHS: CompanyGlyph[] = [
  {
    slug: 'fleur-de-lys',
    label: 'Fleur de Lys',
    node: (
      <g {...S.fill}>
        <path d="M12 2c-1.1 1.5-1.1 3.2 0 4.7 1.1-1.5 1.1-3.2 0-4.7z" />
        <path d="M12 6.2c-.8 1.4-2.5 2-2.5 3.9 0 1 .6 1.8 1.1 2.4-1-.5-2.6-.7-3.4.4-.8 1.1-.3 2.6.9 3.1-.3.1-1.7.2-2 .8h11.8c-.3-.6-1.7-.7-2-.8 1.2-.5 1.7-2 .9-3.1-.8-1.1-2.4-.9-3.4-.4.5-.6 1.1-1.4 1.1-2.4 0-1.9-1.7-2.5-2.5-3.9z" />
        <rect x="9.5" y="17.4" width="5" height="1.7" rx=".5" />
        <rect x="10.4" y="19.6" width="3.2" height="2.4" rx=".5" />
      </g>
    ),
  },
  {
    slug: 'laurel',
    label: 'Laurier romain',
    node: (
      <g {...S.line}>
        <path d="M12 21c-3 0-6-2.5-6-7 0-3 1.2-6 3-8" />
        <path d="M12 21c3 0 6-2.5 6-7 0-3-1.2-6-3-8" />
        <path d="M8 8.5c1.2.2 2 1 2.2 2.2M7.2 12c1.2.1 2 .9 2.2 2.1M7.4 15.5c1.2 0 2 .8 2.3 2" />
        <path d="M16 8.5c-1.2.2-2 1-2.2 2.2M16.8 12c-1.2.1-2 .9-2.2 2.1M16.6 15.5c-1.2 0-2 .8-2.3 2" />
        <circle cx="12" cy="3.4" r="1.3" {...S.fill} stroke="none" />
      </g>
    ),
  },
  {
    slug: 'aquila',
    label: 'Aigle (SPQR)',
    node: (
      <g {...S.line}>
        <path d="M12 4v15" />
        <path d="M12 7c-2-2-5-2.5-8-2 1.5 2 3.5 3.2 5.5 3.2M12 7c2-2 5-2.5 8-2-1.5 2-3.5 3.2-5.5 3.2" />
        <path d="M12 11c-1.5-1.3-3.5-1.7-5.5-1.4 1 1.5 2.6 2.4 4 2.4M12 11c1.5-1.3 3.5-1.7 5.5-1.4-1 1.5-2.6 2.4-4 2.4" />
        <path d="M9.5 19h5M10.5 21h3" />
        <circle cx="12" cy="3.2" r="1.1" {...S.fill} stroke="none" />
      </g>
    ),
  },
  {
    slug: 'greek-temple',
    label: 'Temple grec',
    node: (
      <g {...S.line}>
        <path d="M3 8 12 3l9 5z" />
        <path d="M4.5 8v9M9 8v9M15 8v9M19.5 8v9" />
        <path d="M3 17.5h18M2 20.5h20" />
      </g>
    ),
  },
  {
    slug: 'triskel',
    label: 'Triskèle celtique',
    node: (
      <g {...S.line}>
        <path d="M12 12c0-2.5 1.2-4.8 3.8-5.2 2-.3 3.2 1.2 2.9 2.8-.3 1.4-1.8 1.9-2.7 1.1" />
        <path d="M12 12c2.2 1.2 3.2 3.6 1.9 5.9-1 1.8-3 1.6-3.8.2-.7-1.2 0-2.6 1.2-2.7" />
        <path d="M12 12c-2.2 1.2-4.7.8-5.8-1.5-.9-1.8.4-3.4 2-3.2 1.3.2 1.9 1.6 1.1 2.6" />
        <circle cx="12" cy="12" r="1.1" {...S.fill} stroke="none" />
      </g>
    ),
  },
  {
    slug: 'byzantine-cross',
    label: 'Croix byzantine',
    node: (
      <g {...S.line}>
        <path d="M12 3v18" />
        <path d="M9 7h6" />
        <path d="M7.5 11h9" />
        <path d="M9.5 16.5l5 3M14.5 16.5l-5 3" />
      </g>
    ),
  },
  {
    slug: 'valknut',
    label: 'Valknut nordique',
    node: (
      <g {...S.line}>
        <path d="M12 3 5 15h14z" />
        <path d="M8.5 9 4 21h13z" />
        <path d="M15.5 9 20 21H7z" />
      </g>
    ),
  },
  {
    slug: 'yggdrasil',
    label: 'Arbre-monde',
    node: (
      <g {...S.line}>
        <circle cx="12" cy="9" r="5.5" />
        <path d="M12 14.5v5" />
        <path d="M12 19.5c-2 0-3.5 1-4.5 2M12 19.5c2 0 3.5 1 4.5 2" />
        <path d="M12 4v5M9 6l3 3 3-3" />
      </g>
    ),
  },
  {
    slug: 'oak-leaf',
    label: 'Feuille de chêne',
    node: (
      <g {...S.line}>
        <path d="M12 21V6" />
        <path d="M12 6c0-1.7 1.3-3 3-3-.2 1.4.4 2.3 1.6 2.5-1 1-2.4 1.1-3.3.4M12 9c.4-1.5 1.8-2.2 3.4-1.8-.6 1.2-1.6 1.8-2.7 1.6M12 12c.6-1.4 2.1-1.9 3.6-1.2-.8 1.1-1.9 1.5-2.9 1.1M12 15c.7-1.3 2.3-1.5 3.6-.6-.9 1-2 1.2-3 .7" />
        <path d="M12 6c0-1.7-1.3-3-3-3 .2 1.4-.4 2.3-1.6 2.5 1 1 2.4 1.1 3.3.4M12 9c-.4-1.5-1.8-2.2-3.4-1.8.6 1.2 1.6 1.8 2.7 1.6M12 12c-.6-1.4-2.1-1.9-3.6-1.2.8 1.1 1.9 1.5 2.9 1.1M12 15c-.7-1.3-2.3-1.5-3.6-.6.9 1 2 1.2 3 .7" />
      </g>
    ),
  },
  {
    slug: 'acorn',
    label: 'Gland',
    node: (
      <g {...S.line}>
        <path d="M7 9c0 4 2.2 8 5 8s5-4 5-8z" />
        <path d="M6 9h12" />
        <path d="M12 6.5V9M12 6.5c0-1 .8-1.8 1.8-1.8" />
      </g>
    ),
  },
  {
    slug: 'crescent-star',
    label: 'Croissant & étoile',
    node: (
      <g {...S.line}>
        <path d="M15.5 4a8 8 0 1 0 0 16 6.5 6.5 0 1 1 0-16z" />
        <path d="m18.5 9 .8 1.7 1.8.2-1.3 1.3.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.3 1.8-.2z" />
      </g>
    ),
  },
  {
    slug: 'compass-rose',
    label: 'Rose des vents',
    node: (
      <g {...S.line}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 4 13.5 12 12 20 10.5 12z" {...S.fill} stroke="none" />
        <path d="M4 12 12 10.5 20 12 12 13.5z" />
      </g>
    ),
  },
  {
    slug: 'tower',
    label: 'Tour',
    node: (
      <g {...S.line}>
        <path d="M7 21V8h10v13" />
        <path d="M7 8V5h2v2h2V5h2v2h2V5h2v3" />
        <path d="M11 21v-4h2v4" />
        <path d="M5 21h14" />
      </g>
    ),
  },
  {
    slug: 'drakkar',
    label: 'Drakkar',
    node: (
      <g {...S.line}>
        <path d="M3 13h18l-2.5 5H5.5z" />
        <path d="M5 13c-2-2-2-5 .5-7-.3 1.4.3 2.4 1.5 2.7" />
        <path d="M12 13V5l4 2.5L12 9" />
      </g>
    ),
  },
  {
    slug: 'anchor',
    label: 'Ancre',
    node: (
      <g {...S.line}>
        <circle cx="12" cy="5" r="1.8" />
        <path d="M12 6.8V21" />
        <path d="M8 11h8" />
        <path d="M5 14c0 4 3.5 7 7 7s7-3 7-7" />
        <path d="M5 14l-1.5 1M19 14l1.5 1" />
      </g>
    ),
  },
  {
    slug: 'mountain',
    label: 'Montagne',
    node: (
      <g {...S.line}>
        <path d="M3 19 9.5 7l3.5 6 2-3 5 9z" />
        <path d="M8 11.5 9.5 9l1.5 2.5" />
      </g>
    ),
  },
  {
    slug: 'torch',
    label: 'Flambeau',
    node: (
      <g {...S.line}>
        <path d="M12 3c2.5 2 3 4 1.5 6-.5.7-.5 1.5 0 2-2 .2-3.7-1-3.7-3 0-1.2.6-2.2 1.2-3 .4 .6 1 .8 1.6.6-.7-.9-.9-1.8-.6-2.6z" />
        <path d="M9.5 11h5l-1 3h-3z" />
        <path d="M11 14v7M13 14v7M9.5 21h5" />
      </g>
    ),
  },
  {
    slug: 'sun',
    label: 'Soleil',
    node: (
      <g {...S.line}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19" />
      </g>
    ),
  },
  {
    slug: 'key',
    label: 'Clé',
    node: (
      <g {...S.line}>
        <circle cx="7.5" cy="7.5" r="3.5" />
        <path d="M10 10l9 9" />
        <path d="M16 16l2-2M18.5 18.5l2-2" />
      </g>
    ),
  },
  {
    slug: 'shield',
    label: 'Écu',
    node: (
      <g {...S.line}>
        <path d="M12 3 5 5.5v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9v-6z" />
        <path d="M12 3v18" />
        <path d="M5 9.5h14" />
      </g>
    ),
  },
  {
    slug: 'lyre',
    label: 'Lyre grecque',
    node: (
      <g {...S.line}>
        <path d="M8 20c-2-2-3-5-2.5-9C6 8 7 6.5 9 6M16 20c2-2 3-5 2.5-9C18 8 17 6.5 15 6" />
        <path d="M9 6c1-1.5 5-1.5 6 0" />
        <path d="M10.5 7.5V18M13.5 7.5V18" />
        <path d="M8 20h8" />
      </g>
    ),
  },
  {
    slug: 'amphora',
    label: 'Amphore',
    node: (
      <g {...S.line}>
        <path d="M9 4h6" />
        <path d="M10 4c0 2-2 2.5-2 5 0 3 1.5 4 1.5 6.5S8 19 8 20h8c0-1-1.5-2-1.5-4.5S15 13 15 10c0-2.5-2-3-2-5" />
        <path d="M8 8c-2 .5-3 2-2.5 3.5M16 8c2 .5 3 2 2.5 3.5" />
        <path d="M8 20h8" />
      </g>
    ),
  },
]

export const COMPANY_GLYPH_MAP: Record<string, CompanyGlyph> = Object.fromEntries(
  COMPANY_GLYPHS.map((g) => [g.slug, g]),
)

/** Couleur du glyphe selon le mode mono (none = crème par défaut). */
export function glyphColor(mono: string | null | undefined): string {
  if (mono === 'white') return '#FFFFFF'
  if (mono === 'black') return '#1A1A1A'
  return '#F3E9D2' // crème
}

/** Filtre CSS pour un PNG selon le mode mono. */
export function pngMonoFilter(mono: string | null | undefined): string | undefined {
  if (mono === 'white') return 'brightness(0) invert(1)'
  if (mono === 'black') return 'brightness(0)'
  return undefined
}
