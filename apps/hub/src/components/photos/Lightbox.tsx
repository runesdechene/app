// apps/hub/src/components/photos/Lightbox.tsx
import { useEffect } from 'react'
import { isVideoUrl, type SubmissionImage } from './types'

interface LightboxProps {
  images: SubmissionImage[]
  index: number
  onClose: () => void
  onIndex: (i: number) => void
}

export function Lightbox({ images, index, onClose, onIndex }: LightboxProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onIndex((index - 1 + images.length) % images.length)
      if (e.key === 'ArrowRight') onIndex((index + 1) % images.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, images.length, onClose, onIndex])

  const cur = images[index]
  if (!cur) return null
  return (
    <div className="mod-lightbox" onClick={onClose}>
      <button className="mod-lightbox__close" onClick={onClose}>✕</button>
      <button className="mod-lightbox__nav mod-lightbox__prev" onClick={(e) => { e.stopPropagation(); onIndex((index - 1 + images.length) % images.length) }}>‹</button>
      {isVideoUrl(cur.image_url)
        ? <video src={cur.image_url} controls autoPlay onClick={(e) => e.stopPropagation()} />
        : <img src={cur.image_url} alt="" onClick={(e) => e.stopPropagation()} />}
      <button className="mod-lightbox__nav mod-lightbox__next" onClick={(e) => { e.stopPropagation(); onIndex((index + 1) % images.length) }}>›</button>
    </div>
  )
}
