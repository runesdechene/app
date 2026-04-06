import { useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import './PhotoLightbox.css'

interface PhotoLightboxProps {
  photos: string[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
}

export function PhotoLightbox({ photos, index, onClose, onNavigate }: PhotoLightboxProps) {
  const total = photos.length
  const safeIndex = ((index % total) + total) % total

  const prev = useCallback(() => onNavigate((safeIndex - 1 + total) % total), [safeIndex, total, onNavigate])
  const next = useCallback(() => onNavigate((safeIndex + 1) % total), [safeIndex, total, onNavigate])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, prev, next])

  return createPortal(
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-content" onClick={e => e.stopPropagation()}>
        <img src={photos[safeIndex]} alt="" className="lightbox-img" />

        {total > 1 && (
          <>
            <button className="lightbox-nav lightbox-prev" onClick={prev}>&#8249;</button>
            <button className="lightbox-nav lightbox-next" onClick={next}>&#8250;</button>
            <span className="lightbox-counter">{safeIndex + 1} / {total}</span>
          </>
        )}

        <button className="lightbox-close" onClick={onClose}>&#10005;</button>
      </div>
    </div>,
    document.body
  )
}
