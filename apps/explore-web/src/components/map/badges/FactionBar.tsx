import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlayerStore } from '../../../stores/playerStore'
import { useCrownsStore } from '../../../stores/crownsStore'
import { useFactionGroupStore } from '../../../stores/factionGroupStore'
import { useFactionHallStore } from '../../../stores/factionHallStore'
import { FactionCreateForm } from '../../factions/FactionCreateForm'
import { FactionModal } from '../../auth/FactionModal'
import { CoupeModal } from '../modals/CoupeModal'
import type { CoupeState, CoupeFactionEntry } from '../../../types/coupe'
import './FactionBar.css'

/**
 * Scoreboard des Compagnies sur la carte (mécanique = factions). Layout HORIZONTAL
 * façon Age of Empires : une rangée de chips (emblème + nom + score Coupe), classée.
 * Clic sur une Compagnie → Hall (rejoindre/quitter/éditer). Bouton « Fonder ».
 * Source : get_coupe_state (calcul Coupe à la volée) + factions (méta).
 */

interface FactionRowEnriched extends CoupeFactionEntry {
  pattern: string
  image: string
}

interface FactionMeta {
  id: string
  title: string
  color: string
  pattern: string | null
  image_url: string | null
  order: number
}

export function FactionBar() {
  const userId = usePlayerStore(s => s.userId)
  const userFactionId = usePlayerStore(s => s.userFactionId)
  const balance = useCrownsStore(s => s.balance)
  const loadMine = useFactionGroupStore(s => s.loadMine)
  const FOUND_COST = 200
  const canAfford = balance >= FOUND_COST
  const [stats, setStats] = useState<FactionRowEnriched[]>([])
  const [seasonName, setSeasonName] = useState<string | null>(null)
  const openHall = useFactionHallStore(s => s.open)
  const [showCreate, setShowCreate] = useState(false)
  const [showExplore, setShowExplore] = useState(false)
  const [showCoupeModal, setShowCoupeModal] = useState(false)

  useEffect(() => {
    if (userId) loadMine(userId)
  }, [userId, loadMine])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [coupeRes, factionsRes] = await Promise.all([
        supabase.rpc('get_coupe_state', { p_user_id: userId, p_season_id: null }),
        supabase.from('factions').select('id, title, color, pattern, image_url, order').eq('retired', false).order('order'),
      ])
      if (cancelled) return

      if (coupeRes.error || !coupeRes.data) {
        console.warn('[FactionBar] get_coupe_state failed', coupeRes.error?.message)
        return
      }
      const state = coupeRes.data as CoupeState | { error: string }
      if ('error' in state) return

      const allFactions = (factionsRes.data ?? []) as FactionMeta[]
      const scoreById = new Map<string, CoupeFactionEntry>()
      for (const f of state.factions) scoreById.set(f.factionId, f)

      const enriched: FactionRowEnriched[] = allFactions
        .map<FactionRowEnriched>(f => {
          const s = scoreById.get(f.id)
          return {
            factionId: f.id,
            factionTitle: f.title,
            factionColor: f.color,
            score: s?.score ?? 0,
            memberCount: s?.memberCount ?? 0,
            rank: s?.rank ?? 0,
            pattern: f.pattern ?? '',
            image: f.image_url ?? '',
          }
        })
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score
          const ai = allFactions.findIndex(f => f.id === a.factionId)
          const bi = allFactions.findIndex(f => f.id === b.factionId)
          return ai - bi
        })

      setStats(enriched)
      setSeasonName(state.season?.name ?? null)
    }

    load()
    const id = window.setInterval(load, 30000)
    return () => { cancelled = true; window.clearInterval(id) }
  }, [userId])

  const maxScore = stats[0]?.score ?? 0
  const leaderId = maxScore > 0 ? stats[0].factionId : null

  return (
    <>
      <div className="faction-scoreboard">
        <button
          type="button"
          className="faction-scoreboard-live"
          onClick={() => setShowCoupeModal(true)}
          title={'Voir le classement complet de la saison'}
        >
          <span className="faction-scoreboard-live-dot" />
          Compagnies
          {seasonName && <span className="faction-scoreboard-live-season">{'—'} {seasonName}</span>}
        </button>

        <div className="faction-scoreboard-rail">
          {stats.map(faction => {
            const isLeader = faction.factionId === leaderId
            const isMine = faction.factionId === userFactionId
            return (
              <button
                key={faction.factionId}
                type="button"
                className={`faction-chip${isMine ? ' faction-chip-mine' : ''}`}
                style={{ '--faction-color': faction.factionColor } as React.CSSProperties}
                onClick={() => openHall(faction.factionId)}
                title={faction.factionTitle}
              >
                {isLeader && <span className="faction-chip-crown">{'👑'}</span>}
                {faction.image ? (
                  <img src={faction.image} alt="" className="faction-chip-banner" />
                ) : (
                  <span className="faction-chip-emblem">
                    {faction.pattern && <img src={faction.pattern} alt="" className="faction-chip-emblem-img" />}
                  </span>
                )}
                <span className="faction-chip-name">{faction.factionTitle}</span>
                {isMine && <span className="faction-chip-active" title="Ta bannière active">⚑</span>}
                <span className="faction-chip-score">{'🏆'} {faction.score}</span>
              </button>
            )
          })}

          {userId && (
            <button
              type="button"
              className="faction-scoreboard-explore"
              onClick={() => setShowExplore(true)}
            >
              🔍 Explorer les Compagnies
            </button>
          )}
          {userId && (
            <button
              type="button"
              className="faction-scoreboard-found"
              onClick={() => setShowCreate(true)}
              disabled={!canAfford}
              title={canAfford ? undefined : `Il te faut ${FOUND_COST} 🪙 pour fonder une Compagnie`}
            >
              ⚔️ Fonder — {FOUND_COST} 🪙
            </button>
          )}
        </div>
      </div>

      {showExplore && (
        <FactionModal
          onClose={() => setShowExplore(false)}
          currentFactionId={userFactionId}
          onOpenHall={(id) => {
            setShowExplore(false)
            openHall(id, () => setShowExplore(true))  // ← Retour rouvre l'explorateur
          }}
        />
      )}

      {showCreate && userId && (
        <FactionCreateForm
          userId={userId}
          onSuccess={() => { setShowCreate(false); loadMine(userId) }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {showCoupeModal && <CoupeModal onClose={() => setShowCoupeModal(false)} />}
    </>
  )
}
