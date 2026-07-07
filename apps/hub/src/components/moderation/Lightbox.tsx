import { useCallback, useEffect, useState } from 'react'

interface Props {
  images: string[]      // URLs pleine résolution
  index: number         // index initial
  onClose: () => void
}

// Overlay plein écran pour visionner une ou plusieurs photos.
// Échap ferme ; flèches ← → naviguent ; clic sur le fond ferme.
export function Lightbox({ images, index, onClose }: Props) {
  const [i, setI] = useState(index)
  const many = images.length > 1

  const prev = useCallback(() => setI(v => (v - 1 + images.length) % images.length), [images.length])
  const next = useCallback(() => setI(v => (v + 1) % images.length), [images.length])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, prev, next])

  return (
    <div className="mod-lightbox" onClick={onClose}>
      <button className="mod-lightbox-close" onClick={onClose} aria-label="Fermer">✕</button>
      {many && (
        <button className="mod-lightbox-nav prev" onClick={e => { e.stopPropagation(); prev() }} aria-label="Précédent">‹</button>
      )}
      <img className="mod-lightbox-img" src={images[i]} alt="" onClick={e => e.stopPropagation()} />
      {many && (
        <button className="mod-lightbox-nav next" onClick={e => { e.stopPropagation(); next() }} aria-label="Suivant">›</button>
      )}
      {many && <div className="mod-lightbox-count">{i + 1} / {images.length}</div>}
    </div>
  )
}
