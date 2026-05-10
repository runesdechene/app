import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlayerStore } from '../../../stores/playerStore'
import './AdScreen.css'

interface AdData {
  screen: {
    imageUrl: string
    productUrl: string | null
    title: string | null
  }
  tip: {
    title: string
    subtitle: string | null
    tag: string
  }
}

interface Props {
  onDone: () => void
}

export function AdScreen({ onDone }: Props) {
  const userName = usePlayerStore(s => s.userName)
  const [ad, setAd] = useState<AdData | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Si onboarding (userName === ''), fermer immediatement
  useEffect(() => {
    if (userName === '') {
      onDone()
      setDismissed(true)
    }
  }, [userName, onDone])

  useEffect(() => {
    if (dismissed) return
    async function loadAd() {
      const { data } = await supabase.rpc('get_random_ad')
      if (!data) { onDone(); return }
      setAd(data as AdData)
    }
    loadAd()
  }, [])

  // Fade in quand l'image est chargee
  useEffect(() => {
    if (loaded) {
      const t = setTimeout(() => setVisible(true), 50)
      return () => clearTimeout(t)
    }
  }, [loaded])

  function handleBuy(e: React.MouseEvent) {
    e.stopPropagation()
    if (ad?.screen.productUrl) {
      window.open(ad.screen.productUrl, '_blank', 'noopener,noreferrer')
    }
  }

  if (dismissed) return null
  // Fond opaque immédiat pendant le fetch RPC + image load — cache la page
  // derrière dès le mount, avant que la pub elle-même soit prête à afficher.
  if (!ad) return <div className="loading-screen loading-screen-preload" aria-hidden />


  return (
    <div className={`loading-screen${visible ? ' visible' : ''}`}>
      {/* Fond sombre / flou sur desktop */}
      <div className="loading-screen-backdrop" />

      {/* Carte centrale */}
      <div className="loading-screen-card">
        {/* Image */}
        <div className="loading-screen-image-wrap">
          <img
            src={ad.screen.imageUrl}
            alt=""
            className="loading-screen-bg"
            onLoad={() => setLoaded(true)}
          />
          <div className="loading-screen-image-overlay" />

          {/* Croix de fermeture (haut à droite) */}
          <button className="loading-screen-buy" onClick={onDone} aria-label="Fermer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Texte */}
        <div className="loading-screen-content">
          <span className="loading-screen-tag">
            Le Saviez-vous ?
          </span>
          <h2 className="loading-screen-title">{ad.tip.title}</h2>
          {ad.tip.subtitle && (
            <p className="loading-screen-subtitle">{ad.tip.subtitle}</p>
          )}
        </div>

        {/* Bouton CTA pub (gros, en bas) — affiché seulement s'il y a un
            lien produit ; sinon la croix en haut suffit pour fermer. */}
        {ad.screen.productUrl && (
          <button className="loading-screen-enter loading-screen-enter-inline" onClick={handleBuy}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <span>{ad.screen.title || 'Decouvrir'}</span>
          </button>
        )}
      </div>
    </div>
  )
}
