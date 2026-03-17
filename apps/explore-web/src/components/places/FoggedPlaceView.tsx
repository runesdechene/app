import { useState } from 'react'
import type { PlaceDetail } from '../../hooks/usePlace'
import { usePlayerStore } from '../../stores/playerStore'

/** Haversine distance en mètres */
function haversineM(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

interface Props {
  place: PlaceDetail
  onClose: () => void
  isAuthenticated: boolean
  isOwnFaction: boolean
  onDiscover: () => Promise<void>
  onAuthPrompt?: () => void
}

export function FoggedPlaceView({
  place, onClose, isAuthenticated, isOwnFaction, onDiscover, onAuthPrompt,
}: Props) {
  const energy = usePlayerStore(s => s.energy)
  const maxEnergy = usePlayerStore(s => s.maxEnergy)
  const nextPointIn = usePlayerStore(s => s.nextPointIn)
  const userPosition = usePlayerStore(s => s.userPosition)
  const [discovering, setDiscovering] = useState(false)

  // Énergie fractionnaire (taux fixe 1, cycle 7200s = +0.5/h)
  const CYCLE_SECONDS = 7200
  const isFull = energy >= maxEnergy
  const elapsedInTick = CYCLE_SECONDS - nextPointIn
  const fractionOfTick = CYCLE_SECONDS > 0 ? elapsedInTick / CYCLE_SECONDS : 0
  const fractionalEnergy = isFull
    ? maxEnergy
    : Math.min(energy + fractionOfTick, maxEnergy)

  // Calcul distance GPS
  let isNearby = false
  if (userPosition) {
    const dist = haversineM(
      userPosition.lat, userPosition.lng,
      place.location.latitude, place.location.longitude,
    )
    isNearby = dist <= 500
  }

  const cost = isNearby ? 0 : (isOwnFaction ? 0.5 : 1)
  const canAfford = cost === 0 || fractionalEnergy >= cost

  const images = place.images || []

  return (
    <>
      {/* Header */}
      <div className="place-panel-header">
        <button onClick={onClose} className="place-panel-close" aria-label="Fermer">
          &#10005;
        </button>
      </div>

      {/* Gallery floue */}
      {images.length > 0 && (
        <div className="place-panel-gallery fogged-gallery">
          <img
            src={images[0].url}
            alt="Lieu mystérieux"
            className="place-panel-image"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      )}

      {/* Body */}
      <div className="place-panel-body">
        <h1 className="place-panel-title place-panel-title-blur">{place.title}</h1>

        {/* Badge faction alliée (masqué en mode exploration) */}
        {usePlayerStore.getState().gameMode === 'conquest' && isOwnFaction && place.claim && (
          <div
            className="place-claim-badge"
            style={{ backgroundColor: place.claim.factionColor }}
          >
            <span
              className="place-claim-dot"
              style={{ backgroundColor: place.claim.factionColor }}
            />
            Territoire allié — {place.claim.factionTitle}
          </div>
        )}

        <p className="fog-mystery-text">
          {isOwnFaction
            ? 'Ce lieu appartient à votre faction. Découvrez-le à moindre coût.'
            : 'Ce lieu est encore dans le brouillard. Explorez-le pour en découvrir les secrets.'
          }
        </p>

        {isAuthenticated ? (
          <div className="fog-discover-section">
            <button
              className="discover-btn"
              onClick={async () => {
                setDiscovering(true)
                await onDiscover()
                setDiscovering(false)
              }}
              disabled={discovering || !canAfford}
            >
              {discovering
                ? 'Exploration...'
                : isNearby
                  ? 'Explorer (gratuit — vous êtes à proximité)'
                  : isOwnFaction
                    ? 'Explorer (0.5 point d\'énergie — territoire allié)'
                    : `Explorer (1 point d'énergie)`
              }
            </button>

            <div className="fog-energy-info">
              <span className="fog-energy-count">{Number.isInteger(fractionalEnergy) ? fractionalEnergy : fractionalEnergy.toFixed(1)}/{maxEnergy}</span> points d'énergie
              {!canAfford && (
                <p className="fog-energy-empty">
                  Plus assez d'énergie. Revenez demain ou déplacez-vous à proximité du lieu.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="fog-cta-section">
            <p className="fog-cta-text">
              Rejoignez l'Aventure pour explorer ce lieu et découvrir la carte.
            </p>
            <button
              className="fog-cta-btn"
              onClick={onAuthPrompt}
            >
              Créer un compte
            </button>
          </div>
        )}
      </div>
    </>
  )
}
