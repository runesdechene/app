import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayerStore } from '../stores/playerStore'
import { useCrownsStore } from '../stores/crownsStore'
import { useFactionGroupStore } from '../stores/factionGroupStore'
import { useFactionHallStore } from '../stores/factionHallStore'
import { FactionModal } from '../components/auth/FactionModal'
import { FactionCreateForm } from '../components/factions/FactionCreateForm'
import { CompanyEmblem } from '../components/factions/CompanyEmblem'
import { CoupeModal } from '../components/map/modals/CoupeModal'
import '../components/home/coupe/CoupeHeritages.css'
import './CompaniesPage.css'

const FOUND_COST = 200

/**
 * Page /compagnies (mobile) — remplace l'Activité. Bannière Coupe (→ classement),
 * mes Compagnies (ouvrir/chat), et l'explorateur (annuaire + fonder).
 */
export default function CompaniesPage() {
  const navigate = useNavigate()
  const userId = usePlayerStore(s => s.userId)
  const balance = useCrownsStore(s => s.balance)
  const myFactions = useFactionGroupStore(s => s.myFactions)
  const directory = useFactionGroupStore(s => s.directory)
  const activeFactionId = useFactionGroupStore(s => s.activeFactionId)
  const loadMine = useFactionGroupStore(s => s.loadMine)
  const loadDirectory = useFactionGroupStore(s => s.loadDirectory)
  const openHall = useFactionHallStore(s => s.open)

  const [showCoupe, setShowCoupe] = useState(false)
  const [showExplore, setShowExplore] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    document.title = 'Runes de Chêne — Compagnies'
    if (userId) loadMine(userId)
    loadDirectory()
  }, [userId, loadMine, loadDirectory])

  // Rang + score par Compagnie (depuis l'annuaire trié par score).
  const dirById = useMemo(() => {
    const m = new Map<string, { rank: number; score: number; tags: string[] }>()
    directory.forEach((c, i) => m.set(c.id, { rank: i + 1, score: c.score, tags: c.tags }))
    return m
  }, [directory])

  const canAfford = balance >= FOUND_COST
  const atLimit = myFactions.length >= 2

  return (
    <main className="activity-page-scroll companies-page">
      <h1 className="activity-page-title">Compagnies</h1>

      {/* Podium Coupe des Compagnies (réutilise le look « Coupe des Héritages ») */}
      {directory.length > 0 && (() => {
        const topScore = directory[0]?.score ?? 0
        const podium = [directory[2], directory[1], directory[0]].filter(Boolean) // 3-2-1 (leader à droite)
        return (
          <>
            <h2 className="coupe-section-title" onClick={() => setShowCoupe(true)} style={{ cursor: 'pointer' }}>
              ⚜ Coupe des Compagnies
            </h2>
            <div className="coupe-frame coupe-podium-frame">
              <div className="coupe-podium">
                {podium.map((c) => {
                  const rank = directory.findIndex(d => d.id === c.id) + 1
                  const isLeader = rank === 1 && topScore > 0
                  const h = topScore <= 0 ? 12 : Math.max(Math.round((c.score / topScore) * 80), 12)
                  const roman = rank === 1 ? 'I' : rank === 2 ? 'II' : 'III'
                  return (
                    <div key={c.id} className={`coupe-step${isLeader ? ' coupe-step-leader' : ''}`} role="button" tabIndex={0} onClick={() => openHall(c.id)}>
                      {isLeader ? <span className="coupe-crown" aria-hidden>👑</span> : <span className="coupe-crown-spacer" aria-hidden />}
                      <span className="coupe-step-emblem" style={{ background: c.color }}>
                        <CompanyEmblem
                          color="transparent" name={c.name} imageUrl={c.imageUrl}
                          emblemIcon={c.emblemIcon} emblemMono={c.emblemMono}
                          size={isLeader ? 28 : 24} radius="50%"
                        />
                      </span>
                      <span className="coupe-step-name">{c.name}</span>
                      <span className="coupe-step-pts" style={{ color: c.color }}>{c.score}</span>
                      <span className="coupe-step-block" style={{ height: `${h}px` }}>{roman}</span>
                    </div>
                  )
                })}
              </div>
              <button type="button" className="coupe-podium-footer" onClick={() => setShowCoupe(true)}>
                ▸ Voir le classement complet
              </button>
            </div>
          </>
        )
      })()}

      {/* Mes Compagnies */}
      <h2 className="cp-section">Mes Compagnies {myFactions.length > 0 && <span className="cp-section-count">({myFactions.length}/2)</span>}</h2>

      {myFactions.length === 0 ? (
        <p className="cp-empty">Tu ne portes encore aucune bannière. Rejoins une Compagnie ou fonde la tienne.</p>
      ) : (
        myFactions.map(c => {
          const meta = dirById.get(c.id)
          const isActive = c.id === activeFactionId
          return (
            <div key={c.id} className="cp-card" style={{ borderLeftColor: c.color }}>
              <div className="cp-card-head">
                <CompanyEmblem
                  color={c.color} name={c.name} imageUrl={c.imageUrl}
                  emblemIcon={c.emblemIcon} emblemMono={c.emblemMono}
                  size={52} radius={12}
                />
                <div className="cp-card-headtext">
                  <div className="cp-card-name">{c.name}</div>
                  <div className="cp-card-badges">
                    {isActive && <span className="cp-badge cp-badge-active" style={{ color: c.color, borderColor: c.color }}>⚑ Active</span>}
                    <span className="cp-badge">{c.isFounder ? 'Chef' : 'Membre'}</span>
                  </div>
                </div>
              </div>

              <div className="cp-card-stats">
                <div className="cp-stat"><b>{c.memberCount}</b><span>membres</span></div>
                <div className="cp-stat"><b>{meta ? meta.score.toLocaleString('fr-FR') : '—'}</b><span>points</span></div>
                <div className="cp-stat"><b>{meta ? `#${meta.rank}` : '—'}</b><span>classement</span></div>
              </div>

              <div className="cp-card-actions">
                <button className="cp-btn cp-btn-primary" style={{ background: c.color }} onClick={() => openHall(c.id)}>Ouvrir</button>
                <button className="cp-btn" onClick={() => navigate('/chat')}>Chat</button>
              </div>
            </div>
          )
        })
      )}

      {/* Explorer */}
      <h2 className="cp-section">Explorer</h2>
      <button className="cp-explore-row" onClick={() => setShowExplore(true)}>
        <span className="cp-explore-icon">📖</span>
        <span className="cp-explore-text">
          <b>Annuaire des Compagnies</b>
          <span>{directory.length} Compagnie{directory.length !== 1 ? 's' : ''} active{directory.length !== 1 ? 's' : ''} cette saison</span>
        </span>
        <span className="cp-explore-arrow">›</span>
      </button>
      <button
        className="cp-explore-row"
        onClick={() => { if (canAfford && !atLimit) setShowCreate(true) }}
        disabled={!canAfford || atLimit}
        title={atLimit ? 'Tu fais déjà partie de 2 Compagnies' : !canAfford ? `Il te faut ${FOUND_COST} 🪙` : undefined}
      >
        <span className="cp-explore-icon">⚔️</span>
        <span className="cp-explore-text">
          <b>Fonder une Compagnie</b>
          <span>Crée la tienne et rassemble les tiens — {FOUND_COST} 🪙</span>
        </span>
        <span className="cp-explore-arrow">›</span>
      </button>

      {showCoupe && <CoupeModal onClose={() => setShowCoupe(false)} />}
      {showExplore && (
        <FactionModal
          onClose={() => setShowExplore(false)}
          currentFactionId={activeFactionId}
          onOpenHall={(id) => { setShowExplore(false); openHall(id, () => setShowExplore(true)) }}
        />
      )}
      {showCreate && userId && (
        <FactionCreateForm
          userId={userId}
          onSuccess={() => { setShowCreate(false); loadMine(userId) }}
          onCancel={() => setShowCreate(false)}
        />
      )}
    </main>
  )
}
