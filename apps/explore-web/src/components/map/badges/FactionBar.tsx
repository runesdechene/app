import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlayerStore } from '../../../stores/playerStore'
import { FactionMembersModal } from '../modals/FactionMembersModal'
import { CoupeModal } from '../modals/CoupeModal'
import type { CoupeState, CoupeFactionEntry } from '../../../types/coupe'
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

interface FactionMeta {
  id: string
  title: string
  color: string
  pattern: string | null
  order: number
}

const COUPE_LABEL = 'Héritages'

export function FactionBar() {
  const userFactionId = usePlayerStore(s => s.userFactionId)
  const userId = usePlayerStore(s => s.userId)
  const factionColorMode = usePlayerStore(s => s.factionColorMode)
  const [stats, setStats] = useState<FactionRowEnriched[]>([])
  const [seasonName, setSeasonName] = useState<string | null>(null)
  const [selectedFaction, setSelectedFaction] = useState<FactionRowEnriched | null>(null)
  const [showCoupeModal, setShowCoupeModal] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [coupeRes, factionsRes] = await Promise.all([
        supabase.rpc('get_coupe_state', { p_user_id: userId, p_season_id: null }),
        supabase.from('factions').select('id, title, color, pattern, order').order('order'),
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

      const allFactions = (factionsRes.data ?? []) as FactionMeta[]
      const scoreById = new Map<string, CoupeFactionEntry>()
      for (const f of state.factions) scoreById.set(f.factionId, f)

      // On affiche TOUTES les factions, même celles à 0 pt. Donne un sentiment
      // de compétition complète (page à conquérir au démarrage, domination
      // visible mid-saison). Tri : score desc, puis order DB pour les ex aequo.
      const enriched: FactionRowEnriched[] = allFactions
        .map<FactionRowEnriched>(f => {
          const s = scoreById.get(f.id)
          return {
            factionId:    f.id,
            factionTitle: f.title,
            factionColor: f.color,
            score:        s?.score ?? 0,
            memberCount:  s?.memberCount ?? 0,
            rank:         s?.rank ?? 0,           // 0 = sans rang officiel (à 0 pt)
            pattern:      f.pattern ?? '',
          }
        })
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score
          // ex aequo (notamment à 0 pt) → ordre DB (champs `order` perdu après le map mais on a allFactions trié)
          const ai = allFactions.findIndex(f => f.id === a.factionId)
          const bi = allFactions.findIndex(f => f.id === b.factionId)
          return ai - bi
        })

      setStats(enriched)
      setSeasonName(state.season?.name ?? null)
    }

    if (!factionColorMode) return  // mode Coupe désactivé : pas de fetch, pas de scoreboard

    load()
    // Polling 30s — on ressent la progression quasi-temps réel quand un user
    // ajoute une action (carnet, plantage, énigme) sans avoir à reload la page.
    const id = window.setInterval(load, 30000)
    return () => { cancelled = true; window.clearInterval(id) }
  }, [userId, factionColorMode])

  if (!factionColorMode) return null
  if (stats.length === 0) return null

  const maxScore = stats[0]?.score ?? 0
  // Pas de couronne quand tout le monde est à 0 (début de saison, pas de leader)
  const leaderId = maxScore > 0 ? stats[0].factionId : null

  return (
    <>
      <div className="faction-scoreboard">
        <div className="faction-scoreboard-bars">
          {stats.map(faction => {
            const isLeader = faction.factionId === leaderId
            const isMine = faction.factionId === userFactionId
            // Hauteur proportionnelle au max courant. Une faction à 0 pt → 0%
            // (track gris vide visible, pas de fill). On garde un min de 4%
            // sur les factions qui ONT contribué (pour qu'on voie la barre
            // même à 1 pt face à un leader à 100).
            const heightPct =
              maxScore <= 0          ? 0 :
              faction.score <= 0     ? 0 :
              Math.max(4, Math.round((faction.score / maxScore) * 100))
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
