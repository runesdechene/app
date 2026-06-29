import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { usePlayerStore } from '../../stores/playerStore'
import { useMapStore } from '../../stores/mapStore'
import { useExpeditionsStore } from '../../stores/expeditionsStore'
import { CreateMenu } from '../map/controls/CreateMenu'
import { InfoModal } from '../map/modals/InfoModal'
import { isDemoMode } from '../../lib/demo/isDemoMode'

const MIN_DISCOVERIES_FOR_ADD_PLACE = 3

interface Props {
  onClose: () => void
  onRequestAddGpsMark: () => void
}

export function BottomTabbarPlusMenu({ onClose, onRequestAddGpsMark }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const discoveriesCount = usePlayerStore((s) => s.discoveredIds.size)
  const canAddPlace = discoveriesCount >= MIN_DISCOVERIES_FOR_ADD_PLACE
  const discoveriesNeeded = Math.max(0, MIN_DISCOVERIES_FOR_ADD_PLACE - discoveriesCount)

  const [showLockedInfo, setShowLockedInfo] = useState(false)
  const [showDemoBlocked, setShowDemoBlocked] = useState(false)

  const isOnMap = location.pathname.startsWith('/carte')

  // Borne démo : on garde le menu visible mais toute création est bloquée.
  function blockedInDemo(): boolean {
    if (!isDemoMode()) return false
    onClose()
    setShowDemoBlocked(true)
    return true
  }

  function handleAddPlace() {
    if (blockedInDemo()) return
    onClose()
    useMapStore.getState().setAddPlaceMode(true)
    if (!isOnMap) navigate('/carte')
  }

  function handleAddPlaceLocked() {
    if (blockedInDemo()) return
    onClose()
    setShowLockedInfo(true)
  }

  function handleCreateExpedition() {
    if (blockedInDemo()) return
    onClose()
    useExpeditionsStore.getState().requestOpenCreator(true)
    if (!isOnMap) navigate('/carte')
  }

  function handleAddGpsMark() {
    if (blockedInDemo()) return
    onRequestAddGpsMark()
  }

  return (
    <>
      <CreateMenu
        canAddPlace={canAddPlace}
        discoveriesNeeded={discoveriesNeeded}
        onAddPlace={handleAddPlace}
        onAddPlaceLocked={handleAddPlaceLocked}
        onCreateExpedition={handleCreateExpedition}
        onAddGpsMark={handleAddGpsMark}
        onClose={onClose}
      />

      {showLockedInfo && !canAddPlace && (
        <InfoModal
          icon="🗺️"
          title="Cartographier"
          description={`Pour ajouter un lieu sur la carte, découvre d'abord ${MIN_DISCOVERIES_FOR_ADD_PLACE} lieux. Continue d'explorer pour le débloquer.`}
          rows={[
            { label: 'Condition', value: `Découvrir ${MIN_DISCOVERIES_FOR_ADD_PLACE} lieux` },
            { label: 'Découvertes actuelles', value: `${discoveriesCount} / ${MIN_DISCOVERIES_FOR_ADD_PLACE}` },
            { label: 'Reste', value: discoveriesNeeded === 0 ? 'Débloqué !' : `${discoveriesNeeded} découverte${discoveriesNeeded > 1 ? 's' : ''}` },
          ]}
          onClose={() => setShowLockedInfo(false)}
        />
      )}

      {showDemoBlocked && (
        <InfoModal
          icon="🔒"
          title="Mode démo"
          description="La création de contenu (ajouter un lieu, organiser un événement, poser une marque) n'est pas possible en version démo. Crée ton compte pour jouer pour de vrai !"
          rows={[]}
          onClose={() => setShowDemoBlocked(false)}
        />
      )}

    </>
  )
}
