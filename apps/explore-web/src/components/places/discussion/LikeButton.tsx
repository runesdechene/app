import { useState } from 'react'
import './LikeButton.css'

// Son des couronnes (réutilisé depuis HarvestableChests / PlaceCourtView).
let crownAudio: HTMLAudioElement | null = null
function playCrownSound() {
  try {
    if (!crownAudio) { crownAudio = new Audio('/res/influence_click.mp3'); crownAudio.volume = 0.5 }
    crownAudio.currentTime = 0
    void crownAudio.play()
  } catch { /* audio non bloquant */ }
}

interface LikeButtonProps {
  liked: boolean
  count: number
  disabled?: boolean
  /** 'mini' = action discrète (commentaire) · 'seal' = pilule sceau (description) */
  variant?: 'mini' | 'seal'
  onToggle: () => void
}

export function LikeButton({ liked, count, disabled, variant = 'mini', onToggle }: LikeButtonProps) {
  const [burst, setBurst] = useState(0)

  function handle() {
    if (disabled) return
    // Animation cœur + son uniquement quand on AIME (pas quand on retire).
    if (!liked) { playCrownSound(); setBurst(b => b + 1) }
    onToggle()
  }

  return (
    <button
      className={`like-btn like-btn-${variant}${liked ? ' liked' : ''}`}
      onClick={handle}
      disabled={disabled}
      aria-pressed={liked}
      aria-label={liked ? 'Ne plus aimer' : 'Aimer'}
    >
      <span className="like-btn-ico">{liked ? '❤' : '🤍'}</span>
      {count > 0 && <span className="like-btn-n">{count}</span>}
      {burst > 0 && <span key={burst} className="like-burst" aria-hidden="true">❤</span>}
    </button>
  )
}
