import { useState } from 'react'
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

  if (slides.length === 0) {
    onComplete()
    return null
  }

  const slide = slides[currentIndex]
  const isLast = currentIndex >= slides.length - 1

  function handleNext() {
    if (isLast) {
      onComplete()
    } else {
      setCurrentIndex(currentIndex + 1)
    }
  }

  return (
    <div className="tutorial-overlay">
      <div className="tutorial-modal">
        <button className="tutorial-skip" onClick={onComplete}>
          Passer
        </button>

        {slide.image_url && (
          <img src={slide.image_url} alt="" className="tutorial-image" />
        )}

        <h2 className="tutorial-title">{slide.title}</h2>
        <p className="tutorial-body">{slide.body}</p>

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
