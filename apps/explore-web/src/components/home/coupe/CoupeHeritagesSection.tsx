import { useEffect, useState } from 'react'
import { useCoupe } from '../../../hooks/useCoupe'
import { usePlayerStore } from '../../../stores/playerStore'
import { supabase } from '../../../lib/supabase'
import { FactionMembersModal } from '../../map/modals/FactionMembersModal'
import { CoupeModal } from '../../map/modals/CoupeModal'
import { CoupePodium } from './CoupePodium'
import { CoupeOnboarding } from './CoupeOnboarding'
import { CollectiveCounter } from '../../map/badges/CollectiveCounter'
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

/** Méta emblème par Compagnie (nouveau système : PNG / glyphe / mono), non retourné par get_coupe_state. */
export interface FactionEmblem {
  imageUrl: string | null
  emblemIcon: string | null
  emblemMono: string | null
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
  const [emblemByFactionId, setEmblemByFactionId] = useState<Record<string, FactionEmblem>>({})
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

  // Charger les emblèmes des Compagnies (nouveau système, non retourné par get_coupe_state).
  useEffect(() => {
    let cancelled = false
    async function loadEmblems() {
      const { data, error: e } = await supabase.from('factions').select('id, image_url, emblem_icon, emblem_mono')
      if (cancelled) return
      if (e || !data) {
        console.warn('[CoupeHeritagesSection] failed to load faction emblems', e?.message)
        return
      }
      const map: Record<string, FactionEmblem> = {}
      for (const row of data as Array<{ id: string; image_url: string | null; emblem_icon: string | null; emblem_mono: string | null }>) {
        map[row.id] = { imageUrl: row.image_url, emblemIcon: row.emblem_icon, emblemMono: row.emblem_mono }
      }
      setEmblemByFactionId(map)
    }
    loadEmblems()
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
        {state.collective && (
          <CollectiveCounter
            lieuxSortisOubli={state.collective.lieuxSortisOubli}
            lieuxVisites={state.collective.lieuxVisites}
            enigmesPercees={state.collective.enigmesPercees}
            variant="full"
          />
        )}
        <CoupePodium
          factions={sortedFactions}
          userFactionId={userFactionId}
          seasonName={seasonName}
          emblemByFactionId={emblemByFactionId}
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
      emblemByFactionId={emblemByFactionId}
      openFactionModal={openFactionModal}
    />
  )
}
