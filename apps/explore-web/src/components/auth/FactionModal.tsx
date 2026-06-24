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
}

/**
 * « Explorer les Compagnies » — réutilise l'ancienne modale de choix de faction.
 * Liste les Compagnies actives (non retirées), rejoindre en 1 clic (join_faction),
 * ou fonder. Mécanique = faction ; user-facing = Compagnie.
 */
export function FactionModal({ onClose, currentFactionId }: FactionModalProps) {
  const userId = usePlayerStore(s => s.userId)
  const directory = useFactionGroupStore(s => s.directory)
  const loadDirectory = useFactionGroupStore(s => s.loadDirectory)
  const myFactions = useFactionGroupStore(s => s.myFactions)
  const loadMine = useFactionGroupStore(s => s.loadMine)
  const join = useFactionGroupStore(s => s.join)
  const openHall = useFactionHallStore(s => s.open)

  const [loading, setLoading] = useState(true)
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    if (userId) loadMine(userId)
    Promise.resolve(loadDirectory()).finally(() => setLoading(false))
  }, [userId, loadDirectory, loadMine])

  const atLimit = myFactions.length >= 2
  const isMobile = window.innerWidth <= 768

  async function handleCardClick(factionId: string) {
    if (!userId) return
    const alreadyMember = myFactions.some(f => f.id === factionId)
    if (alreadyMember) {
      onClose()
      openHall(factionId)
      return
    }
    if (atLimit) { setError('Tu fais déjà partie de 2 Compagnies.'); return }
    setJoiningId(factionId)
    setError(null)
    const result = await join(userId, factionId)
    setJoiningId(null)
    if ('error' in result) {
      setError(
        result.error === 'too_many' ? 'Tu fais déjà partie de 2 Compagnies.'
        : 'Impossible de rejoindre pour le moment.'
      )
      return
    }
    onClose(true)
    openHall(factionId)
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
          Rejoins une Compagnie pour porter ses couleurs, ou fonde la tienne. Toutes œuvrent à
          réenchanter le monde — choisis la tienne.
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
                  disabled={joiningId === c.id}
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
                    {joiningId === c.id && <span className="faction-card-badge">…</span>}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {error && (
          <p className="faction-modal-subtitle" style={{ color: '#c0392b' }}>{error}</p>
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
