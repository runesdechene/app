import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useDefisStore } from '../../stores/defisStore'
import '../map/modals/VictoryModal.css'

/**
 * Butin d'un Défi accompli. Réutilise le style canonique de récompense
 * (VictoryModal / LevelUpModal) — overlay sombre, label, grande icône, titre,
 * encart gains, bouton « Continuer » — pour rester cohérent avec le reste du jeu.
 * Accent doré (vs rouge conquête de VictoryModal) via --victory-accent.
 */
export function QuestRewardModal() {
  const reward = useDefisStore((s) => s.pendingRewards[0] ?? null)
  const shiftReward = useDefisStore((s) => s.shiftReward)

  useEffect(() => {
    if (!reward) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') shiftReward() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reward, shiftReward])

  if (!reward) return null

  const node = (
    <div className="victory-overlay" onClick={shiftReward}>
      <div
        className="victory-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ '--victory-accent': '#c9a24a' } as React.CSSProperties}
      >
        <div className="victory-label">Défi accompli</div>
        <div className="victory-icon" aria-hidden>{reward.icon || '🏆'}</div>
        <div className="victory-place">{reward.title}</div>
        <div className="victory-quote">Ton effort est récompensé.</div>
        {reward.crowns > 0 && (
          <div className="victory-gains">
            <span className="victory-gain">+{reward.crowns} 🪙 Couronnes</span>
          </div>
        )}
        <button className="victory-btn" onClick={shiftReward}>Accepter</button>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
