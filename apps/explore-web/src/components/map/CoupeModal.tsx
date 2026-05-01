import { useState } from 'react'
import { useMapStore } from '../../stores/mapStore'
import { useCoupe } from '../../hooks/useCoupe'
import { CoupeRulesModal } from './CoupeRulesModal'
import './LeaderboardModal.css'
import './CoupeModal.css'

type CoupeTab = 'classement' | 'top' | 'moi'

interface Props {
  onClose: () => void
}

const TAB_LABELS: Record<CoupeTab, string> = {
  classement: 'Classement',
  top:        'Top contributeurs',
  moi:        'Ma contribution',
}

function formatSeasonRange(startedAt: string, endedAt: string | null): string {
  const start = new Date(startedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  if (endedAt) {
    const end = new Date(endedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    return `${start} → ${end}`
  }
  return `Depuis le ${start}`
}

export function CoupeModal({ onClose }: Props) {
  const [tab, setTab] = useState<CoupeTab>('classement')
  const [showRules, setShowRules] = useState(false)
  const { state, loading, error } = useCoupe(true)

  function handlePlayerClick(playerId: string) {
    onClose()
    useMapStore.getState().setSelectedPlayerId(playerId)
  }

  return (
    <>
      <div className="leaderboard-overlay" onClick={onClose}>
        <div className="leaderboard-modal coupe-modal" onClick={e => e.stopPropagation()}>
          <button className="player-modal-close" onClick={onClose} aria-label="Fermer">
            &#10005;
          </button>

          <h2 className="leaderboard-title">
            {'🏆'} Coupe des Héritages
          </h2>
          {state?.season && (
            <p className="coupe-season-label">
              <strong>{state.season.name}</strong>
              <span className="coupe-season-range">{formatSeasonRange(state.season.startedAt, state.season.endedAt)}</span>
            </p>
          )}

          <button className="coupe-rules-btn" onClick={() => setShowRules(true)}>
            {'ⓘ'} Voir les règles et le barème
          </button>

          <div className="leaderboard-tabs">
            {(['classement', 'top', 'moi'] as CoupeTab[]).map(t => (
              <button
                key={t}
                className={`leaderboard-tab${tab === t ? ' active' : ''}`}
                onClick={() => setTab(t)}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>

          {loading && <div className="player-modal-loading">Chargement...</div>}
          {error && <div className="player-modal-loading">Erreur de chargement</div>}

          {!loading && !error && state && (
            <>
              {/* === Classement par faction === */}
              {tab === 'classement' && (
                <div className="coupe-list">
                  {state.factions.length === 0 ? (
                    <p className="coupe-empty">Aucune action enregistrée pour cette saison.</p>
                  ) : (
                    state.factions.map(f => (
                      <div key={f.factionId} className="coupe-faction-row" style={{ '--f-color': f.factionColor } as React.CSSProperties}>
                        <span className="coupe-rank">#{f.rank}</span>
                        <span className="coupe-faction-dot" />
                        <span className="coupe-faction-name">{f.factionTitle}</span>
                        <span className="coupe-faction-meta">{f.memberCount} contributeur{f.memberCount > 1 ? 's' : ''}</span>
                        <span className="coupe-score">{f.score} pts</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* === Top contributeurs (top 20 toutes factions) === */}
              {tab === 'top' && (
                <div className="coupe-list">
                  {state.topUsers.length === 0 ? (
                    <p className="coupe-empty">Aucun contributeur pour le moment.</p>
                  ) : (
                    state.topUsers.map(u => (
                      <button
                        key={u.userId}
                        className="coupe-user-row"
                        onClick={() => handlePlayerClick(u.userId)}
                      >
                        <span className="coupe-rank">#{u.rank}</span>
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt="" className="coupe-user-avatar" />
                        ) : (
                          <span className="coupe-user-avatar coupe-user-avatar-fallback">
                            {u.displayName.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="coupe-user-name">{u.displayName}</span>
                        <span className="coupe-score">{u.score} pts</span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* === Ma contribution détaillée === */}
              {tab === 'moi' && (
                <div className="coupe-breakdown">
                  {!state.myBreakdown ? (
                    <p className="coupe-empty">Connecte-toi pour voir ta contribution.</p>
                  ) : (
                    <>
                      <div className="coupe-my-total">
                        <span className="coupe-my-total-label">Ma contribution à la Coupe</span>
                        <span className="coupe-my-total-value">{state.myBreakdown.score} pts</span>
                      </div>

                      <div className="coupe-breakdown-rows">
                        <div className="coupe-breakdown-row">
                          <span className="coupe-breakdown-label">Lieux ajoutés</span>
                          <span className="coupe-breakdown-meta">{state.myBreakdown.lieuxAjoutes} × 7</span>
                          <span className="coupe-breakdown-pts">{state.myBreakdown.lieuxAjoutes * 7} pts</span>
                        </div>
                        <div className="coupe-breakdown-row">
                          <span className="coupe-breakdown-label">Plantages de bannière</span>
                          <span className="coupe-breakdown-meta">{state.myBreakdown.plantages} × 5</span>
                          <span className="coupe-breakdown-pts">{state.myBreakdown.plantages * 5} pts</span>
                        </div>
                        <div className="coupe-breakdown-row">
                          <span className="coupe-breakdown-label">Carnets</span>
                          <span className="coupe-breakdown-meta">{state.myBreakdown.carnets} × 3</span>
                          <span className="coupe-breakdown-pts">{state.myBreakdown.carnets * 3} pts</span>
                        </div>
                        <div className="coupe-breakdown-row">
                          <span className="coupe-breakdown-label">Photos ajoutées</span>
                          <span className="coupe-breakdown-meta">{state.myBreakdown.photos} × 1</span>
                          <span className="coupe-breakdown-pts">{state.myBreakdown.photos} pts</span>
                        </div>
                        <div className="coupe-breakdown-row">
                          <span className="coupe-breakdown-label">Énigmes résolues</span>
                          <span className="coupe-breakdown-meta">{state.myBreakdown.enigmes} × 1</span>
                          <span className="coupe-breakdown-pts">{state.myBreakdown.enigmes} pts</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showRules && <CoupeRulesModal onClose={() => setShowRules(false)} />}
    </>
  )
}
