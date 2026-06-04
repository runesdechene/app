import { useState, useEffect } from 'react'
import type { PlaceDetail } from '../../../hooks/usePlace'
import { usePlayerStore } from '../../../stores/playerStore'
import { supabase } from '../../../lib/supabase'
import './FoggedPlaceView.css'
import { ShareButton } from '../actions/ShareButton'

interface CostPreview {
  cost: number
  energy: number
  canAfford: boolean
  gloryPreview?: number
  detail: {
    baseCost: number
    distanceKm: number
    distanceMult: number
    tagReduction: number
    sameFaction: boolean
  }
}

interface Props {
  place: PlaceDetail
  onClose: () => void
  isAuthenticated: boolean
  isOwnFaction: boolean
  onDiscover: () => Promise<void>
  onAuthPrompt?: () => void
}

/** "3m 12s" / "45s" / "2m". Vide si seconds ≤ 0. */
function formatNextPoint(seconds: number): string {
  if (seconds <= 0) return ''
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

export function FoggedPlaceView({
  place, onClose, isAuthenticated, isOwnFaction, onDiscover, onAuthPrompt,
}: Props) {
  const maxEnergy = usePlayerStore(s => s.maxEnergy)
  const energy = usePlayerStore(s => s.energy)
  const nextPointIn = usePlayerStore(s => s.nextPointIn)
  const userId = usePlayerStore(s => s.userId)
  const [discovering, setDiscovering] = useState(false)
  const [preview, setPreview] = useState<CostPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    setPreviewLoading(true)
    const userPos = usePlayerStore.getState().userPosition
    supabase.rpc('preview_action_cost', {
      p_user_id: userId,
      p_place_id: place.id,
      p_action: 'discover',
      p_user_lat: userPos?.lat ?? null,
      p_user_lng: userPos?.lng ?? null,
    }).then(({ data }) => {
      if (data) setPreview(data as CostPreview)
      setPreviewLoading(false)
    })
  }, [userId, place.id])

  const cost = preview?.cost ?? 1
  // Le check utilise `energy` (vraie valeur DB, NUMERIC(6,1)) et PAS la
  // fractionalité illusoire calculee cote client. Sans ca, le bouton parait
  // actif a 1.9 (illusion de regen) mais le serveur refuse car energy_points
  // entier = 1 < 1.5. Cf. discover_place mig 124:87-89.
  const canAfford = cost === 0 || energy >= cost
  const d = preview?.detail
  const images = place.images || []
  const isFull = energy >= maxEnergy
  const nextPointLabel = !isFull ? formatNextPoint(nextPointIn) : ''

  return (
    <>
      {/* Hero — blurred */}
      <div className="place-hero fogged-hero">
        {images.length > 0 ? (
          <img
            src={images[0].url}
            alt=""
            className="place-hero-img"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="place-hero-placeholder" />
        )}

      </div>

      {/* Close button — outside hero so not affected by blur */}
      <div className="fogged-close">
        <ShareButton placeName={place.title} placeSlug={place.slug} />
        <button onClick={onClose} className="place-hero-pill place-hero-pill-icon place-hero-close" aria-label="Fermer">
          &#10005;
        </button>
      </div>

      {/* Body */}
      <div className="place-body">
        <h2 className="place-title fogged-title">{place.title}</h2>

        <p className="fog-mystery-text">
          {isOwnFaction
            ? 'Ce lieu est sous influence de votre faction. Découvrez-le à moindre coût.'
            : 'Ce lieu est encore dans le brouillard. Dépensez votre énergie pour le réler.'
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
              disabled={discovering || !canAfford || previewLoading}
            >
              {discovering
                ? 'Découverte...'
                : previewLoading
                  ? 'Calcul du coûtt...'
                  : cost === 0
                    ? 'Découvrir (gratuit \u2014 proximit\u00e9)'
                    : `Découvrir (${cost} \u26a1)`
              }
            </button>

            {d && (
              <div className="fog-cost-detail">
                <span>{'\uD83D\uDCCD'} {d.distanceKm} km \u2014 {d.distanceMult === 1 ? 'x1' : d.distanceMult < 1 ? `x${d.distanceMult} (sur place)` : `x${d.distanceMult}`}</span>
                {d.sameFaction && (
                  <span className="fog-cost-bonus">Territoire alli\u00e9 : co\u00fbt /2</span>
                )}
                {d.tagReduction > 0 && (
                  <span className="fog-cost-bonus">Faction : -{d.tagReduction}%</span>
                )}
              </div>
            )}

            <div className="fog-energy-info">
              <span className="fog-energy-count">{energy.toFixed(1)}/{maxEnergy}</span> énergie
              {nextPointLabel && (
                <span className="fog-energy-next"> · +1 dans {nextPointLabel}</span>
              )}
              {!canAfford && (
                <p className="fog-energy-empty">
                  Pas assez d'énergie. Revenez plus tard ou déplacez-vous à proximité.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="fog-cta-section">
            <p className="fog-cta-text">
              Rejoignez l'aventure pour découvrir ce lieu.
            </p>
            <button className="fog-cta-btn" onClick={onAuthPrompt}>
              Cr\u00e9er un compte
            </button>
          </div>
        )}
      </div>
    </>
  )
}
