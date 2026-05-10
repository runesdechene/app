import { useState, useRef } from 'react'
import './TutorialModal.css'

export interface TutorialSlide {
  id: number
  phase: 'before' | 'after'
  position: number
  title: string
  body: string
  image_url: string | null
}

interface TutorialModalProps {
  slides: TutorialSlide[]
  onComplete: () => void
  lastSlideLabel?: string
}

export function TutorialModal({ slides, onComplete, lastSlideLabel = 'Suivant' }: TutorialModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  if (slides.length === 0) {
    onComplete()
    return null
  }

  const isLast = currentIndex >= slides.length - 1

  function handleNext() {
    if (isLast) {
      onComplete()
    } else {
      setCurrentIndex(currentIndex + 1)
    }
  }

  function handlePrev() {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1)
  }

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (!touchStart.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchStart.current.x
    const dy = t.clientY - touchStart.current.y
    touchStart.current = null
    // Ignore si geste majoritairement vertical (scroll) ou trop court.
    if (Math.abs(dy) > Math.abs(dx)) return
    if (Math.abs(dx) < 50) return
    if (dx < 0) handleNext()
    else handlePrev()
  }

  return (
    <div className="tutorial-overlay modal-mobile-fullscreen-backdrop">
      <div className="tutorial-modal modal-mobile-fullscreen">
        <button className="tutorial-skip" onClick={onComplete}>
          Passer
        </button>

        <div
          className="tutorial-viewport"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="tutorial-track"
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          >
            {slides.map((s, i) => (
              <div
                key={s.id}
                className="tutorial-slide-page"
                aria-hidden={i !== currentIndex}
              >
                <div className="tutorial-slide-inner">
                  {s.image_url && (
                    <img src={s.image_url} alt="" className="tutorial-image" />
                  )}
                  <h2 className="tutorial-title">{s.title}</h2>
                  <p className="tutorial-body">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="tutorial-dots">
          {slides.map((_, i) => (
            <span
              key={i}
              className={`tutorial-dot${i === currentIndex ? ' active' : ''}`}
            />
          ))}
        </div>

        <button className="tutorial-next" onClick={handleNext}>
          {isLast ? lastSlideLabel : 'Suivant'}
        </button>
      </div>
    </div>
  )
}
