import { useState, useEffect } from 'react'
import type { PlaceDetail } from '../../hooks/usePlace'
import { usePlayerStore } from '../../stores/playerStore'
import { supabase } from '../../lib/supabase'
import './FoggedPlaceView.css'

interface CostPreview {
  cost: number
  energy: number
  canAfford: boolean
  gloryPreview: number
  detail: {
    baseCost: number
    distanceKm: number
    distanceMult: number
    tagReduction: number
    sameFaction: boolean
    fortifCost: number
    zoneCost: number
    sizeCost: number
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

export function FoggedPlaceView({
  place, onClose, isAuthenticated, isOwnFaction, onDiscover, onAuthPrompt,
}: Props) {
  const maxEnergy = usePlayerStore(s => s.maxEnergy)
  const energy = usePlayerStore(s => s.energy)
  const nextPointIn = usePlayerStore(s => s.nextPointIn)
  const energyCycle = usePlayerStore(s => s.energyCycle)
  const userId = usePlayerStore(s => s.userId)
  const activeBuff = usePlayerStore(s => s.activeBuff)
  const [discovering, setDiscovering] = useState(false)
  const [preview, setPreview] = useState<CostPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(true)

  const isFull = energy >= maxEnergy
  const elapsedInTick = energyCycle - nextPointIn
  const fractionOfTick = energyCycle > 0 ? elapsedInTick / energyCycle : 0
  const fractionalEnergy = isFull ? maxEnergy : Math.min(energy + fractionOfTick, maxEnergy)

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

  const discoverFree = activeBuff === 'free_discover'
  const discoverDiscount = activeBuff === 'discount_discover' ? parseFloat(localStorage.getItem('activeBuffValue') ?? '0') : 0

  let cost = preview?.cost ?? 1
  if (discoverFree) cost = 0
  else if (discoverDiscount > 0) cost = Math.max(0.5, Math.round((cost * (1 - discoverDiscount / 100)) * 2) / 2)

  const canAfford = cost === 0 || fractionalEnergy >= cost
  const d = preview?.detail
  const images = place.images || []

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

        <div className="place-hero-top-right">
          <button onClick={onClose} className="place-hero-pill place-hero-close" aria-label="Fermer">
            &#10005;
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="place-body">
        <h2 className="place-title fogged-title">{place.title}</h2>

        {isOwnFaction && place.claim && (
          <div className="place-claim-badge" style={{ backgroundColor: place.claim.factionColor }}>
            Territoire alli\u00e9 \u2014 {place.claim.factionTitle}
          </div>
        )}

        <p className="fog-mystery-text">
          {isOwnFaction
            ? 'Ce lieu appartient \u00e0 votre h\u00e9ritage. D\u00e9couvrez-le \u00e0 moindre co\u00fbt.'
            : 'Ce lieu est encore dans le brouillard. D\u00e9pensez de l\u2019\u00e9nergie pour le r\u00e9v\u00e9ler.'
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
                ? 'D\u00e9couverte...'
                : previewLoading
                  ? 'Calcul du co\u00fbt...'
                  : discoverFree
                    ? 'D\u00e9couvrir (gratuit \u2728)'
                    : cost === 0
                      ? 'D\u00e9couvrir (gratuit \u2014 proximit\u00e9)'
                      : `D\u00e9couvrir (${cost} \u26a1)`
              }
            </button>

            {d && !discoverFree && (
              <div className="fog-cost-detail">
                <span>{'\uD83D\uDCCD'} {d.distanceKm} km \u2014 {d.distanceMult === 1 ? 'x1' : d.distanceMult < 1 ? `x${d.distanceMult} (sur place)` : `x${d.distanceMult}`}</span>
                {d.sameFaction && (
                  <span className="fog-cost-bonus">Territoire alli\u00e9 : co\u00fbt /2</span>
                )}
                {d.tagReduction > 0 && (
                  <span className="fog-cost-bonus">H\u00e9ritage : -{d.tagReduction}%</span>
                )}
                {preview?.gloryPreview != null && preview.gloryPreview > 0 && (
                  <span className="fog-cost-glory">{'\uD83C\uDF96\uFE0F'} +{preview.gloryPreview} gloire</span>
                )}
              </div>
            )}

            <div className="fog-energy-info">
              <span className="fog-energy-count">{fractionalEnergy.toFixed(1)}/{maxEnergy}</span> \u00e9nergie
              {!canAfford && (
                <p className="fog-energy-empty">
                  Pas assez d'\u00e9nergie. Revenez plus tard ou d\u00e9placez-vous \u00e0 proximit\u00e9.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="fog-cta-section">
            <p className="fog-cta-text">
              Rejoignez l'aventure pour d\u00e9couvrir ce lieu.
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
