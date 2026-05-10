import { useEffect, useState } from 'react'
import { useCoupe } from '../../../hooks/useCoupe'
import { usePlayerStore } from '../../../stores/playerStore'
import { supabase } from '../../../lib/supabase'
import { FactionMembersModal } from '../../map/modals/FactionMembersModal'
import { CoupeModal } from '../../map/modals/CoupeModal'
import { CoupePodium } from './CoupePodium'
import { CoupeOnboarding } from './CoupeOnboarding'
import type { CoupeFactionEntry } from '../../../types/coupe'

interface CoupeHeritagesSectionProps {
  /** Ouvre la FactionModal de sélection (récupéré via useOutletContext dans HomePage). */
  openFactionModal: () => void
}

interface SelectedFactionState {
  factionId: string
  factionTitle: string
  factionColor: string
}

/**
 * Section Home — Coupe des Héritages.
 *
 * Toujours visible (pas de toggle factionColorMode). Aiguille rendu Podium
 * (user dans une Maison) ou Onboarding (user sans Maison).
 *
 * Refetch :
 *  - au mount (useCoupe autoLoad=true)
 *  - au retour sur l'onglet (visibilitychange)
 *  - PAS de polling 30s (différent du FactionBar carte)
 *
 * Edge cases (return null) :
 *  - state null + loading initial
 *  - error
 *  - season null
 *  - factions.length < 4 (config dev/test, impossible en prod)
 */
export function CoupeHeritagesSection({ openFactionModal }: CoupeHeritagesSectionProps) {
  const userFactionId = usePlayerStore(s => s.userFactionId)
  const { state, loading, error, refresh } = useCoupe(true, 0)
  const [patternByFactionId, setPatternByFactionId] = useState<Record<string, string | null>>({})
  const [selectedFaction, setSelectedFaction] = useState<SelectedFactionState | null>(null)
  const [showCoupeModal, setShowCoupeModal] = useState(false)

  // Refetch quand l'onglet redevient visible
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [refresh])

  // Charger les pattern URLs des factions (table factions, non retourné par get_coupe_state)
  useEffect(() => {
    let cancelled = false
    async function loadPatterns() {
      const { data, error: e } = await supabase.from('factions').select('id, pattern')
      if (cancelled) return
      if (e || !data) {
        console.warn('[CoupeHeritagesSection] failed to load faction patterns', e?.message)
        return
      }
      const map: Record<string, string | null> = {}
      for (const row of data as Array<{ id: string; pattern: string | null }>) {
        map[row.id] = row.pattern
      }
      setPatternByFactionId(map)
    }
    loadPatterns()
    return () => { cancelled = true }
  }, [])

  // Edge cases : section cachée
  if (loading && !state) return null
  if (error) {
    console.warn('[CoupeHeritagesSection] get_coupe_state error:', error)
    return null
  }
  if (!state) return null
  if (!state.season) return null

  // Tri factions par score desc, ex aequo selon ordre du tableau retourné par RPC
  const sortedFactions: CoupeFactionEntry[] = [...state.factions].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return 0
  })

  if (sortedFactions.length < 4) {
    console.warn('[CoupeHeritagesSection] expected 4 factions, got', sortedFactions.length)
    return null
  }

  const seasonName = state.season.name

  if (userFactionId) {
    return (
      <>
        <CoupePodium
          factions={sortedFactions}
          userFactionId={userFactionId}
          seasonName={seasonName}
          patternByFactionId={patternByFactionId}
          onClickFaction={(factionId, factionTitle, factionColor) =>
            setSelectedFaction({ factionId, factionTitle, factionColor })
          }
          onClickAll={() => setShowCoupeModal(true)}
        />
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

  return (
    <CoupeOnboarding
      factions={sortedFactions}
      seasonName={seasonName}
      patternByFactionId={patternByFactionId}
      openFactionModal={openFactionModal}
    />
  )
}
