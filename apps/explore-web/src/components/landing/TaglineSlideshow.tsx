import { useState, useEffect, useRef } from 'react'
import './TaglineSlideshow.css'

interface TaglineSlideshowProps {
  taglines: readonly string[]
  rotationMs?: number
}

export default function TaglineSlideshow({ taglines, rotationMs = 4000 }: TaglineSlideshowProps) {
  const [current, setCurrent] = useState(0)
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (taglines.length <= 1) return

    function start() {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
      intervalRef.current = window.setInterval(() => {
        setCurrent(c => (c + 1) % taglines.length)
      }, rotationMs)
    }

    start()
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
    }
  }, [taglines.length, rotationMs])

  function handleDotClick(i: number) {
    setCurrent(i)
    if (intervalRef.current) window.clearInterval(intervalRef.current)
    intervalRef.current = window.setInterval(() => {
      setCurrent(c => (c + 1) % taglines.length)
    }, rotationMs)
  }

  if (taglines.length === 0) return null

  return (
    <div className="tagline-slideshow">
      <div className="tagline-slideshow__track">
        {taglines.map((text, i) => (
          <p
            key={i}
            className={`tagline-slideshow__slide${i === current ? ' is-active' : ''}`}
          >
            « {text} »
          </p>
        ))}
      </div>
      {taglines.length > 1 && (
        <div className="tagline-slideshow__dots" role="tablist" aria-label="Sélection des taglines">
          {taglines.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`tagline-slideshow__dot${i === current ? ' is-active' : ''}`}
              onClick={() => handleDotClick(i)}
              aria-label={`Tagline ${i + 1}`}
              aria-selected={i === current}
              role="tab"
            />
          ))}
        </div>
      )}
    </div>
  )
}
