import { useRef, useState } from 'react'
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
  count?: number
  disabled?: boolean
  /** 'action' = texte « J'aime » (commentaire) · 'seal' = pilule sceau (description) */
  variant?: 'action' | 'seal'
  onToggle: () => void | Promise<void>
}

export function LikeButton({ liked, count = 0, disabled, variant = 'action', onToggle }: LikeButtonProps) {
  const [burst, setBurst] = useState(0)
  // Verrou SYNCHRONE : empêche un 2e déclenchement dans le même tick (tap mobile
  // touch+click, double-clic) qui ferait like puis unlike = net zéro → le like
  // semblait "ne pas s'enregistrer". Le state `disabled` est asynchrone et ne
  // suffisait pas.
  const lock = useRef(false)

  async function handle() {
    if (disabled || lock.current) return
    lock.current = true
    // Animation cœur + son uniquement quand on AIME (pas quand on retire).
    if (!liked) { playCrownSound(); setBurst(b => b + 1) }
    try { await onToggle() } finally { lock.current = false }
  }

  return (
    <button
      className={`like-btn like-btn-${variant}${liked ? ' liked' : ''}`}
      onClick={handle}
      disabled={disabled}
      aria-pressed={liked}
      aria-label={liked ? 'Ne plus aimer' : 'Aimer'}
    >
      {variant === 'action' ? (
        <span className="like-btn-label">J'aime</span>
      ) : (
        <>
          <span className="like-btn-ico">{liked ? '❤' : '🤍'}</span>
          {count > 0 && <span className="like-btn-n">{count}</span>}
        </>
      )}
      {burst > 0 && <span key={burst} className="like-burst" aria-hidden="true">❤</span>}
    </button>
  )
}
