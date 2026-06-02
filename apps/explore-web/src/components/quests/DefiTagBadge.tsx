import type { Defi } from '../../types/defi'

/**
 * Pastille visuelle d'un défi : disque de la couleur du tag de lieu + icône SVG
 * blanche masquée par-dessus (même langage que les marqueurs de la carte).
 * Fallback sur l'emoji du défi si aucun tag / aucune icône (ex. énigme).
 */
export function DefiTagBadge({ defi, size = 28 }: { defi: Defi; size?: number }) {
  const tag = defi.tag
  if (tag && tag.icon) {
    return (
      <span
        className="defi-tag-badge"
        style={{ width: size, height: size, background: tag.color || '#7a5a2e' }}
        title={tag.title ?? undefined}
        aria-hidden
      >
        <span
          className="defi-tag-badge-icon"
          style={{ WebkitMaskImage: `url(${tag.icon})`, maskImage: `url(${tag.icon})` }}
        />
      </span>
    )
  }
  return (
    <span className="defi-tag-badge-emoji" style={{ fontSize: size * 0.78 }} aria-hidden>
      {defi.icon}
    </span>
  )
}
