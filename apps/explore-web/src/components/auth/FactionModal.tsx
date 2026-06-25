import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePlayerStore } from '../../stores/playerStore'
import { useCrownsStore } from '../../stores/crownsStore'
import { useFactionGroupStore } from '../../stores/factionGroupStore'
import { useFactionHallStore } from '../../stores/factionHallStore'
import { FactionCreateForm } from '../factions/FactionCreateForm'
import { CompanyEmblem } from '../factions/CompanyEmblem'
import { readableInk } from '../../lib/textFormat'
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
  const balance = useCrownsStore(s => s.balance)
  const FOUND_COST = 50

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

  return createPortal(
    <div className="faction-explore-overlay" onClick={() => onClose(false)}>
      <div
        className={`faction-modal${isMobile ? ' faction-modal-mobile' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <button className="auth-modal-close" onClick={() => onClose(false)} aria-label="Fermer">
          &#10005;
        </button>

        <h2 className="faction-modal-title">Explorer Les Compagnies</h2>
        <p className="faction-modal-subtitle">
          Ouvre une Compagnie pour lire sa mission et son classement, puis postule et grimpe les échelons — ou fonde la tienne. Elles oeuvrent toutes à la mission de Runes de Chêne.
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
                  style={{ '--faction-color': c.color, '--faction-ink': readableInk(c.color) } as React.CSSProperties}
                  onClick={() => handleCardClick(c.id)}
                >
                  <div className="faction-card-head">
                    <CompanyEmblem
                      color={c.color} name={c.name} imageUrl={c.imageUrl}
                      emblemIcon={c.emblemIcon} emblemMono={c.emblemMono}
                      size={48} radius={11}
                    />
                    <span className="faction-card-name">{c.name}</span>
                    {isMember && <span className="faction-card-badge">{isActive ? 'Principale' : 'Allié'}</span>}
                    {!isMember && c.locked && <span className="faction-card-badge faction-card-badge-full">🔒 Complète</span>}
                  </div>
                  {c.description && (
                    <div className="faction-card-desc">{c.description}</div>
                  )}
                  <div className="faction-card-meta">
                    👥 {c.memberCount} membre{c.memberCount !== 1 ? 's' : ''}
                  </div>
                  {c.tags && c.tags.length > 0 && (
                    <div className="faction-card-tags">
                      {c.tags.slice(0, 4).map(t => (
                        <span key={t} className="faction-card-tag" style={{ borderColor: readableInk(c.color), color: readableInk(c.color) }}>{t}</span>
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}

        <button
          className="faction-modal-found"
          onClick={() => { if (!atLimit && balance >= FOUND_COST) setShowCreate(true) }}
          disabled={atLimit || balance < FOUND_COST}
          title={
            atLimit ? 'Tu fais déjà partie de 2 Compagnies'
            : balance < FOUND_COST ? `Il te faut ${FOUND_COST} 🪙 pour fonder une Compagnie`
            : undefined
          }
        >
          ⚔️ Fonder ma propre Compagnie — {FOUND_COST} 🪙
        </button>
      </div>

      {showCreate && userId && (
        <FactionCreateForm
          userId={userId}
          onSuccess={() => { setShowCreate(false); onClose(true) }}
          onCancel={() => setShowCreate(false)}
        />
      )}
    </div>,
    document.body,
  )
}
