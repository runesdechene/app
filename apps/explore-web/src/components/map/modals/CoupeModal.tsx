import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMapStore } from '../../../stores/mapStore'
import { useCoupe } from '../../../hooks/useCoupe'
import { useGloryRulesStore } from '../../../stores/gloryRulesStore'
import { CoupeRulesModal } from './CoupeRulesModal'
import { supabase } from '../../../lib/supabase'
import { formatFrenchLongDate } from '../../../lib/dateFormat'
import './LeaderboardModal.css'
import './CoupeModal.css'

interface FactionMeta {
  color: string
  pattern: string | null
}

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
  const start = formatFrenchLongDate(startedAt)
  if (endedAt) return `${start} → ${formatFrenchLongDate(endedAt)}`
  return `Depuis le ${start}`
}

export function CoupeModal({ onClose }: Props) {
  const [tab, setTab] = useState<CoupeTab>('classement')
  const [showRules, setShowRules] = useState(false)
  const { state, loading, error } = useCoupe(true)
  const [factionMeta, setFactionMeta] = useState<Map<string, FactionMeta>>(new Map())
  // V068 : barème dynamique pour le tab "Ma contribution" (avant : × hardcodé,
  // décalé par rapport au score réel calculé en SQL via _user_coupe_score)
  const ruleGet = useGloryRulesStore(s => s.get)
  const cAdd     = ruleGet('coupe.add_place')
  const cPlant   = ruleGet('coupe.plant_flag')
  const cVisit   = ruleGet('coupe.visit_gps')
  const cEnigma  = ruleGet('coupe.enigma_easy') // fixe quelle que soit la diff.

  // Fetch les couleurs / patterns de faction une seule fois pour enrichir le
  // tab "Top contributeurs" avec un petit emblème à côté de chaque user.
  useEffect(() => {
    supabase.from('factions').select('id, color, pattern').then(({ data }) => {
      if (!data) return
      const m = new Map<string, FactionMeta>()
      for (const f of data as Array<{ id: string; color: string; pattern: string | null }>) {
        m.set(f.id, { color: f.color, pattern: f.pattern })
      }
      setFactionMeta(m)
    })
  }, [])

  function handlePlayerClick(playerId: string) {
    onClose()
    useMapStore.getState().setSelectedPlayerId(playerId)
  }

  // Portal vers document.body : sort de tout stacking context parent (chat,
  // toasts, map container) qui pourrait plafonner le z-index de la modal.
  const modalNode = (
    <>
      <div className="leaderboard-overlay" onClick={onClose}>
        <div className="leaderboard-modal coupe-modal" onClick={e => e.stopPropagation()}>
          <button className="player-modal-close" onClick={onClose} aria-label="Fermer">
            &#10005;
          </button>

          <h2 className="leaderboard-title">
            {'🏆'} Coupe des Compagnies
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
                    state.topUsers.map(u => {
                      const meta = factionMeta.get(u.factionId)
                      return (
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
                          {meta && (
                            <span
                              className="coupe-user-faction-emblem"
                              style={{ background: meta.color }}
                              title="Faction du joueur"
                              aria-hidden
                            >
                              {meta.pattern && (
                                <img src={meta.pattern} alt="" className="coupe-user-faction-emblem-img" />
                              )}
                            </span>
                          )}
                          <span className="coupe-score">{u.score} pts</span>
                        </button>
                      )
                    })
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
                          <span className="coupe-breakdown-meta">{state.myBreakdown.lieuxAjoutes} × {cAdd}</span>
                          <span className="coupe-breakdown-pts">{state.myBreakdown.lieuxAjoutes * cAdd} pts</span>
                        </div>
                        <div className="coupe-breakdown-row">
                          <span className="coupe-breakdown-label">Plantages de bannière</span>
                          <span className="coupe-breakdown-meta">{state.myBreakdown.plantages} × {cPlant}</span>
                          <span className="coupe-breakdown-pts">{state.myBreakdown.plantages * cPlant} pts</span>
                        </div>
                        <div className="coupe-breakdown-row">
                          <span className="coupe-breakdown-label">Lieux explorés (GPS)</span>
                          <span className="coupe-breakdown-meta">{state.myBreakdown.lieuxExplores} × {cVisit}</span>
                          <span className="coupe-breakdown-pts">{state.myBreakdown.lieuxExplores * cVisit} pts</span>
                        </div>
                        <div className="coupe-breakdown-row">
                          <span className="coupe-breakdown-label">
                            Énigmes résolues
                            {state.myBreakdown.enigmes.total > 0 && (
                              <span style={{ fontSize: '0.85em', opacity: 0.6, marginLeft: 6 }}>
                                ({state.myBreakdown.enigmes.hard}h • {state.myBreakdown.enigmes.medium}m • {state.myBreakdown.enigmes.easy + state.myBreakdown.enigmes.veryEasy}e)
                              </span>
                            )}
                          </span>
                          <span className="coupe-breakdown-meta">{state.myBreakdown.enigmes.total} × {cEnigma}</span>
                          <span className="coupe-breakdown-pts">{state.myBreakdown.enigmes.total * cEnigma} pts</span>
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

  return createPortal(modalNode, document.body)
}
