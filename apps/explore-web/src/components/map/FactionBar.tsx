import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import { FactionMembersModal } from './FactionMembersModal'
import { CoupeModal } from './CoupeModal'
import type { CoupeState, CoupeFactionEntry } from '../../types/coupe'
import './FactionBar.css'

/**
 * V0.7 phase 3 — Scoreboard schématique des Héritages sur la carte.
 * Source : RPC get_coupe_state (calcul à la volée). Avant phase 3, ce composant
 * lisait place_influence.placed_points (V0.5, gelé pour le score Coupe).
 *
 * Layout : jauges VERTICALES côte à côte, identifiées par leur emblème +
 * couleur de faction. Pas de texte de nom (cohérent avec une lecture rapide
 * type AoE). Hauteur jauge proportionnelle au score relatif (fraction du max,
 * pas du total — comme ça la 1ère faction est toujours pleine).
 */

interface FactionRowEnriched extends CoupeFactionEntry {
  pattern: string
}

const COUPE_LABEL = 'Coupe des Héritages'

export function FactionBar() {
  const userFactionId = usePlayerStore(s => s.userFactionId)
  const userId = usePlayerStore(s => s.userId)
  const [stats, setStats] = useState<FactionRowEnriched[]>([])
  const [seasonName, setSeasonName] = useState<string | null>(null)
  const [selectedFaction, setSelectedFaction] = useState<FactionRowEnriched | null>(null)
  const [showCoupeModal, setShowCoupeModal] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [coupeRes, factionsRes] = await Promise.all([
        supabase.rpc('get_coupe_state', { p_user_id: userId, p_season_id: null }),
        supabase.from('factions').select('id, pattern'),
      ])
      if (cancelled) return

      if (coupeRes.error || !coupeRes.data) {
        console.warn('[FactionBar] get_coupe_state failed', coupeRes.error?.message)
        return
      }
      const state = coupeRes.data as CoupeState | { error: string }
      if ('error' in state) {
        console.warn('[FactionBar] coupe error:', state.error)
        return
      }

      const patternByFaction = new Map<string, string>()
      for (const f of (factionsRes.data ?? []) as Array<{ id: string; pattern: string | null }>) {
        if (f.pattern) patternByFaction.set(f.id, f.pattern)
      }

      const enriched: FactionRowEnriched[] = state.factions.map(f => ({
        ...f,
        pattern: patternByFaction.get(f.factionId) ?? '',
      }))

      setStats(enriched)
      setSeasonName(state.season?.name ?? null)
    }

    load()
    return () => { cancelled = true }
  }, [userId])

  if (stats.length === 0) return null

  const maxScore = stats[0]?.score ?? 1   // factions sont triées par rank croissant côté RPC
  const leaderId = stats[0].factionId

  return (
    <>
      <div className="faction-scoreboard">
        <div className="faction-scoreboard-bars">
          {stats.map(faction => {
            const isLeader = faction.factionId === leaderId
            const isMine = faction.factionId === userFactionId
            const heightPct = maxScore > 0
              ? Math.max(8, Math.round((faction.score / maxScore) * 100))
              : 0
            return (
              <div
                key={faction.factionId}
                className={`faction-scoreboard-col${isMine ? ' faction-scoreboard-col-mine' : ''}`}
                style={{ '--faction-color': faction.factionColor } as React.CSSProperties}
                onClick={() => setSelectedFaction(faction)}
                title={faction.factionTitle}
              >
                {isLeader ? (
                  <span className="faction-scoreboard-crown">{'👑'}</span>
                ) : (
                  <span className="faction-scoreboard-crown-spacer" aria-hidden />
                )}
                <span className="faction-scoreboard-emblem">
                  {faction.pattern && (
                    <img src={faction.pattern} alt="" className="faction-scoreboard-emblem-img" />
                  )}
                </span>
                <span className="faction-scoreboard-track">
                  <span className="faction-scoreboard-fill" style={{ height: `${heightPct}%` }} />
                </span>
                <span className="faction-scoreboard-score">{faction.score}</span>
              </div>
            )
          })}
        </div>

        <button
          type="button"
          className="faction-scoreboard-live"
          onClick={() => setShowCoupeModal(true)}
          title={'Voir le classement complet de la Coupe des Héritages'}
        >
          <span className="faction-scoreboard-live-dot" />
          {COUPE_LABEL}
          {seasonName && <span className="faction-scoreboard-live-season">{'—'} {seasonName}</span>}
        </button>
      </div>

      {selectedFaction && (
        <FactionMembersModal
          factionId={selectedFaction.factionId}
          factionTitle={selectedFaction.factionTitle}
          factionColor={selectedFaction.factionColor}
          onClose={() => setSelectedFaction(null)}
        />
      )}

      {showCoupeModal && <CoupeModal onClose={() => setShowCoupeModal(false)} />}
    </>
  )
}
