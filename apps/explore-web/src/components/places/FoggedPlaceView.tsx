import { useState, useEffect } from 'react'
import type { PlaceDetail } from '../../hooks/usePlace'
import { usePlayerStore } from '../../stores/playerStore'
import { supabase } from '../../lib/supabase'
import './FoggedPlaceView.css'

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
  const energyCycle = usePlayerStore(s => s.energyCycle)
  const userPosition = usePlayerStore(s => s.userPosition)
  const userId = usePlayerStore(s => s.userId)
  const [discovering, setDiscovering] = useState(false)
  const [tagReduction, setTagReduction] = useState(0)

  useEffect(() => {
    if (userId) {
      supabase.rpc('get_faction_tag_reduction', { p_user_id: userId, p_place_id: place.id })
        .then(({ data }) => { if (data != null) setTagReduction(Number(data) || 0) })
    }
  }, [userId, place.id])

  const isFull = energy >= maxEnergy
  const elapsedInTick = energyCycle - nextPointIn
  const fractionOfTick = energyCycle > 0 ? elapsedInTick / energyCycle : 0
  const fractionalEnergy = isFull
    ? maxEnergy
    : Math.min(energy + fractionOfTick, maxEnergy)

  // Calcul distance GPS
  let isNearby = false
  let distanceKm = 999
  if (userPosition) {
    const distM = haversineM(
      userPosition.lat, userPosition.lng,
      place.location.latitude, place.location.longitude,
    )
    distanceKm = distM / 1000
    isNearby = distM <= 500
  }

  const activeBuff = usePlayerStore(s => s.activeBuff)

  // Multiplicateur de distance
  const distMult = distanceKm < 0.5 ? 0.5 : distanceKm < 10 ? 1 : distanceKm < 50 ? 2 : 3
  // Coût de base depuis le tag (TODO: lire base_cost du tag, pour l'instant 1)
  const baseCost = 1
  const discoverFree = activeBuff === 'free_discover'
  const discoverDiscount = activeBuff === 'discount_discover' ? parseFloat(localStorage.getItem('activeBuffValue') ?? '0') : 0
  let cost = discoverFree ? 0 : (isNearby ? 0 : baseCost * distMult * (1 - tagReduction / 100))
  if (!isNearby && isOwnFaction) cost = cost * 0.5
  if (discoverDiscount > 0) cost = Math.max(0, cost - discoverDiscount)
  // Arrondir au 0.5
  cost = Math.round(cost * 2) / 2
  if (!isNearby && !discoverFree && cost > 0) cost = Math.max(0.5, cost)
  // Use raw (server-side) energy for afford check, not interpolated display value
  const canAfford = cost === 0 || energy >= cost

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
            ? 'Ce lieu appartient à votre héritage. Découvrez-le à moindre coût.'
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
                ? 'Découverte...'
                : discoverFree
                  ? 'Découvrir (gratuit ✨ compétence active)'
                  : discoverDiscount > 0
                    ? `Découvrir (${cost} ⚡ — compétence -${discoverDiscount})`
                    : isNearby
                      ? 'Découvrir (gratuit — vous êtes à proximité)'
                      : `Découvrir (${cost} ⚡)`
              }
            </button>

            {!isNearby && distMult > 1 && (
              <div className="fog-distance-info" style={{ fontSize: 11, color: '#8A7B6A', marginTop: 4 }}>
                {'\uD83D\uDCCD'} Distance ({Math.round(distanceKm)} km) : cout x{distMult}
              </div>
            )}
            {!isNearby && isOwnFaction && (
              <div className="fog-distance-info" style={{ fontSize: 11, color: '#2a7a30', marginTop: 2 }}>
                Territoire allié : cout /2
              </div>
            )}
            {tagReduction > 0 && (
              <div className="fog-distance-info" style={{ fontSize: 11, color: '#2a7a30', marginTop: 2 }}>
                {'\uD83C\uDF96\uFE0F'} Bonus héritage : -{tagReduction}%
              </div>
            )}
            <div className="fog-energy-info">
              <span className="fog-energy-count">{Number.isInteger(fractionalEnergy) ? fractionalEnergy : fractionalEnergy.toFixed(1)}/{maxEnergy}</span> énergie
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
