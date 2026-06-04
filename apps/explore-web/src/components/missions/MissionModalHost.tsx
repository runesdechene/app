import { useEffect } from 'react'
import { MissionModal } from './MissionModal'
import { useMissionsStore } from '../../stores/missionsStore'

/**
 * Hôte de la MissionModal — encapsule le cycle piloté par missionsStore
 * (pending → consume → openMissionSlug → render).
 *
 * Monté indifféremment depuis le HUD carte (ExpeditionsHud, desktop) ou la
 * home mobile (HomePage). C'est ce qui garantit que la Mission s'ouvre
 * PARTOUT où MissionEntryCard est rendu : sans cet hôte sur /accueil, le tap
 * sur la carte Mission ne déclenchait aucune modale sur mobile.
 *
 * Les deux montages ne coexistent jamais (routes /carte et /accueil exclusives),
 * donc pas de double consommation du pending.
 */
export function MissionModalHost() {
  const pendingMission = useMissionsStore((s) => s.pendingOpenMissionSlug)
  const openMissionSlug = useMissionsStore((s) => s.openMissionSlug)
  const consumePending = useMissionsStore((s) => s.consumePending)
  const close = useMissionsStore((s) => s.close)

  useEffect(() => {
    if (pendingMission) consumePending()
  }, [pendingMission, consumePending])

  if (!openMissionSlug) return null
  return <MissionModal key={openMissionSlug} slug={openMissionSlug} onClose={close} />
}
