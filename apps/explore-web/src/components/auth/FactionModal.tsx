import { useEffect, useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useFactionGroupStore } from '../../stores/factionGroupStore'
import { useFactionHallStore } from '../../stores/factionHallStore'
import { FactionCreateForm } from '../factions/FactionCreateForm'
import './FactionModal.css'

interface FactionModalProps {
  onClose: (joined?: boolean) => void
  /** Compagnie active (bannière) — pour marquer la carte « active ». */
  currentFactionId: string | null
  /** Clic sur une Compagnie → ouvrir son Hall (lecture avant de rejoindre).
   *  Si fourni, l'hôte gère l'ouverture (+ bouton Retour vers l'explorateur). */
  onOpenHall?: (factionId: string) => void
}

/**
 * « Explorer les Compagnies » — liste les Compagnies actives (non retirées).
 * Cliquer une Compagnie ouvre son HALL (on lit la mission/le classement, puis on
 * postule). Pas de join automatique. Ou fonder la sienne.
 */
export function FactionModal({ onClose, currentFactionId, onOpenHall }: FactionModalProps) {
  const userId = usePlayerStore(s => s.userId)
  const directory = useFactionGroupStore(s => s.directory)
  const loadDirectory = useFactionGroupStore(s => s.loadDirectory)
  const myFactions = useFactionGroupStore(s => s.myFactions)
  const loadMine = useFactionGroupStore(s => s.loadMine)
  const openHall = useFactionHallStore(s => s.open)

  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    if (userId) loadMine(userId)
    Promise.resolve(loadDirectory()).finally(() => setLoading(false))
  }, [userId, loadDirectory, loadMine])

  const atLimit = myFactions.length >= 2
  const isMobile = window.innerWidth <= 768

  function handleCardClick(factionId: string) {
    if (onOpenHall) onOpenHall(factionId)
    else { onClose(); openHall(factionId) }
  }

  return (
    <div className="auth-overlay" onClick={() => onClose(false)} style={isMobile ? { zIndex: 10001 } : undefined}>
      <div
        className={`faction-modal${isMobile ? ' faction-modal-mobile' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <button className="auth-modal-close" onClick={() => onClose(false)} aria-label="Fermer">
          &#10005;
        </button>

        <h2 className="faction-modal-title">Explorer les Compagnies</h2>
        <p className="faction-modal-subtitle">
          Ouvre une Compagnie pour lire sa mission et son classement, puis postule — ou fonde la tienne.
        </p>

        {loading ? (
          <p className="faction-modal-loading">Chargement…</p>
        ) : directory.length === 0 ? (
          <p className="faction-modal-loading">Aucune Compagnie pour l'instant. Fonde la première !</p>
        ) : (
          <div className="faction-modal-grid">
            {directory.map(c => {
              const isMember = myFactions.some(f => f.id === c.id)
              const isActive = currentFactionId === c.id
              return (
                <button
                  key={c.id}
                  className={`faction-card${isActive ? ' active' : ''}`}
                  style={{ '--faction-color': c.color } as React.CSSProperties}
                  onClick={() => handleCardClick(c.id)}
                >
                  {c.imageUrl ? (
                    <img src={c.imageUrl} alt={c.name} className="faction-card-img" />
                  ) : (
                    <div className="faction-card-placeholder" style={{ backgroundColor: c.color }} />
                  )}
                  <div className="faction-card-body">
                    <span className="faction-card-name">{c.name}</span>
                    {c.description && (
                      <div className="faction-card-desc">{c.description}</div>
                    )}
                    <div className="faction-card-desc" style={{ opacity: 0.7, marginTop: 4 }}>
                      👥 {c.memberCount} · 🏆 {c.score}
                    </div>
                    {isMember && <span className="faction-card-badge">{isActive ? 'Active' : 'Membre'}</span>}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <button
          className="faction-modal-leave"
          onClick={() => !atLimit && setShowCreate(true)}
          disabled={atLimit}
          title={atLimit ? 'Tu fais déjà partie de 2 Compagnies' : undefined}
        >
          ⚔️ Fonder une Compagnie — 200 🪙
        </button>
      </div>

      {showCreate && userId && (
        <FactionCreateForm
          userId={userId}
          onSuccess={() => { setShowCreate(false); onClose(true) }}
          onCancel={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}
