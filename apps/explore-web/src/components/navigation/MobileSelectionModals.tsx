import { useMapStore } from '../../stores/mapStore'
import { useAuth } from '../../hooks/useAuth'
import { PlacePanel } from '../places/views/PlacePanel'
import { PlayerProfileModal } from '../map/modals/PlayerProfileModal'

/**
 * Hôte des modales de sélection lieu/joueur partagées entre les pages
 * mobile qui peuvent les déclencher (HomePage, ActivityPage, ChatPage —
 * via clic sur un toast ou une carte de lieu).
 *
 * Source unique : useMapStore.selectedPlaceId / selectedPlayerId.
 * MapPage gère sa propre instanciation desktop (panel non-fullscreen).
 */
export function MobileSelectionModals() {
  const { user } = useAuth()
  const selectedPlaceId = useMapStore((s) => s.selectedPlaceId)
  const setSelectedPlaceId = useMapStore((s) => s.setSelectedPlaceId)
  const selectedPlayerId = useMapStore((s) => s.selectedPlayerId)
  const setSelectedPlayerId = useMapStore((s) => s.setSelectedPlayerId)

  return (
    <>
      <PlacePanel
        placeId={selectedPlaceId}
        onClose={() => setSelectedPlaceId(null)}
        userEmail={user?.email ?? null}
        mobileFullscreen
      />
      {selectedPlayerId && (
        <PlayerProfileModal
          playerId={selectedPlayerId}
          onClose={() => setSelectedPlayerId(null)}
        />
      )}
    </>
  )
}
