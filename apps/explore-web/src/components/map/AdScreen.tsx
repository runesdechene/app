import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
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

  // Fond opaque immédiat pendant le chargement (cache la carte)
  if (dismissed || !ad) return null

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

          {/* Bouton acheter */}
          {ad.screen.productUrl && (
            <button className="loading-screen-buy" onClick={handleBuy}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              {ad.screen.title || 'Decouvrir'}
            </button>
          )}
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

        {/* Bouton entrer */}
        <button className="loading-screen-enter" onClick={onDone}>
          Entrer sur la carte
        </button>
      </div>
    </div>
  )
}
