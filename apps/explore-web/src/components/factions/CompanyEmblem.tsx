import type { CSSProperties } from 'react'
import { COMPANY_GLYPH_MAP, glyphColor, pngMonoFilter } from '../../lib/companyEmblems'
import './CompanyEmblem.css'

interface Props {
  color: string
  name?: string | null
  imageUrl?: string | null
  emblemIcon?: string | null
  emblemMono?: string | null
  /** Taille du carré en px (défaut 44). */
  size?: number
  /** Rayon des coins (défaut '50%' = rond). */
  radius?: number | string
  className?: string
  style?: CSSProperties
}

/**
 * Rendu unifié d'un emblème de Compagnie : fond couleur + (PNG → sinon glyphe → sinon
 * initiale). Le mode mono (none/white/black) colore le glyphe ou filtre le PNG.
 * Source unique de vérité du rendu d'emblème (carte / Hall / cartes / scoreboard).
 */
export function CompanyEmblem({
  color, name, imageUrl, emblemIcon, emblemMono,
  size = 44, radius = '50%', className, style,
}: Props) {
  const glyph = emblemIcon ? COMPANY_GLYPH_MAP[emblemIcon] : undefined

  return (
    <span
      className={`company-emblem${className ? ' ' + className : ''}`}
      style={{ width: size, height: size, borderRadius: radius, background: color, ...style }}
      aria-hidden
    >
      {imageUrl ? (
        <img className="company-emblem-img" src={imageUrl} alt="" style={{ filter: pngMonoFilter(emblemMono) }} />
      ) : glyph ? (
        <svg
          className="company-emblem-glyph" viewBox="0 0 24 24"
          width={Math.round(size * 0.62)} height={Math.round(size * 0.62)}
          style={{ color: glyphColor(emblemMono) }}
        >
          {glyph.node}
        </svg>
      ) : (
        <span className="company-emblem-letter" style={{ fontSize: Math.round(size * 0.44) }}>
          {(name ?? '?').charAt(0).toUpperCase() || '?'}
        </span>
      )}
    </span>
  )
}
