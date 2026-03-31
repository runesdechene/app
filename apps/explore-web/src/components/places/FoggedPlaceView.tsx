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

  // Energie fractionnaire pour affichage
  const isFull = energy >= maxEnergy
  const elapsedInTick = energyCycle - nextPointIn
  const fractionOfTick = energyCycle > 0 ? elapsedInTick / energyCycle : 0
  const fractionalEnergy = isFull ? maxEnergy : Math.min(energy + fractionOfTick, maxEnergy)

  // Fetch le vrai coût depuis le serveur
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
    }).then(({ data, error }) => {
      console.log('[COST PREVIEW discover]', { data, error })
      if (data) setPreview(data as CostPreview)
      setPreviewLoading(false)
    })
  }, [userId, place.id])

  const discoverFree = activeBuff === 'free_discover'
  const discoverDiscount = activeBuff === 'discount_discover' ? parseFloat(localStorage.getItem('activeBuffValue') ?? '0') : 0

  // Coût final (serveur comme source de vérité, 0 si buff gratuit)
  let cost = preview?.cost ?? 1
  if (discoverFree) cost = 0
  else if (discoverDiscount > 0) cost = Math.max(0.5, Math.round((cost * (1 - discoverDiscount / 100)) * 2) / 2)

  const canAfford = cost === 0 || fractionalEnergy >= cost
  const d = preview?.detail
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

        {usePlayerStore.getState().gameMode === 'conquest' && isOwnFaction && place.claim && (
          <div className="place-claim-badge" style={{ backgroundColor: place.claim.factionColor }}>
            <span className="place-claim-dot" style={{ backgroundColor: place.claim.factionColor }} />
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
              disabled={discovering || !canAfford || previewLoading}
            >
              {discovering
                ? 'Découverte...'
                : previewLoading
                  ? 'Calcul du coût...'
                  : discoverFree
                    ? 'Découvrir (gratuit ✨ compétence active)'
                    : cost === 0
                      ? 'Découvrir (gratuit — vous êtes à proximité)'
                      : `Découvrir (${cost} ⚡)`
              }
            </button>

            {d && !discoverFree && (
              <div className="claim-cost-detail">
                <span>{'\uD83D\uDCCD'}({d.distanceKm} km) : {d.distanceMult === 1 ? 'x1' : d.distanceMult < 1 ? `x${d.distanceMult} (sur place)` : `x${d.distanceMult}`}</span>
                {d.sameFaction && (
                  <span style={{ color: '#2a7a30' }}>Territoire : coût /2</span>
                )}
                {d.tagReduction > 0 && (
                  <span style={{ color: '#2a7a30' }}>{'\uD83C\uDF96\uFE0F'} Héritage : -{d.tagReduction}%</span>
                )}
                {preview?.gloryPreview && (
                  <span style={{ color: '#b8860b' }}>{'\uD83C\uDF96\uFE0F'} +{preview.gloryPreview}</span>
                )}
              </div>
            )}

            <div className="fog-energy-info">
              <span className="fog-energy-count">{fractionalEnergy.toFixed(1)}/{maxEnergy}</span> énergie
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
            <button className="fog-cta-btn" onClick={onAuthPrompt}>
              Créer un compte
            </button>
          </div>
        )}
      </div>
    </>
  )
}
