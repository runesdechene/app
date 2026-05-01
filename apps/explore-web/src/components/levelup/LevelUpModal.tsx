import { useEffect, useState } from 'react'
import './LevelUpModal.css'

interface Props {
  levelBefore: number
  levelAfter: number
  onClose: () => void
}

const QUOTES_BY_LEVEL: Record<number, string> = {
  5: 'Tu as gagné ton premier vrai palier, Compagnon.',
  10: 'Dix paliers gravis. La marche te porte.',
  15: 'Te voilà Veilleur, dans le sens fort du mot.',
  20: 'Vingt niveaux. Ton nom commence à porter.',
  25: 'Tu es désormais un Héros local.',
  30: 'Tu es désormais un Héros régional. Ton renom dépasse ta vallée.',
  40: 'Quarante paliers. Peu de Veilleurs y arrivent.',
  42: 'Tu portes désormais le titre de Héros.',
  50: 'Légende. Le sommet est à toi.',
}

export function LevelUpModal({ levelBefore, levelAfter, onClose }: Props) {
  const isMulti = levelAfter - levelBefore > 1
  const [displayLevel, setDisplayLevel] = useState(levelBefore)

  useEffect(() => {
    if (!isMulti) {
      setDisplayLevel(levelAfter)
      return
    }
    const startTime = Date.now()
    const duration = 800
    const tick = () => {
      const t = Math.min(1, (Date.now() - startTime) / duration)
      const v = Math.round(levelBefore + (levelAfter - levelBefore) * t)
      setDisplayLevel(v)
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [isMulti, levelBefore, levelAfter])

  const quote = QUOTES_BY_LEVEL[levelAfter] ?? 'Ta gloire grandit, Veilleur.'

  return (
    <div className="lvlup-overlay" onClick={onClose}>
      <div className="lvlup-modal" onClick={(e) => e.stopPropagation()}>
        <div className="lvlup-label">
          {isMulti ? "Plusieurs paliers d'un coup" : 'Tu as gagné un palier'}
        </div>
        <div className="lvlup-num">
          {isMulti
            ? <>Niveau <span>{displayLevel}</span></>
            : <>Niveau {levelAfter}</>
          }
        </div>
        <div className="lvlup-quote">« {quote} »</div>
        <button className="lvlup-btn" onClick={onClose}>Continuer</button>
      </div>
    </div>
  )
}
