import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import './HomeBannerCard.css'

interface Banner {
  id: number
  imageUrl: string
  title: string
  subtitle: string | null
  linkUrl: string
  overlayColor: string
  overlayOpacity: number
  tagColor: string
  titleColor: string
  subtitleColor: string
}

/** Construit le gradient overlay à partir de la couleur hex + opacity max.
 *  Préserve les ratios originaux (0.85 / 0.5 / 0.2) pour le fade-image-à-droite,
 *  scalés proportionnellement par overlayOpacity (0→1). */
export function buildOverlayGradient(hexColor: string, opacity: number): string {
  const r = parseInt(hexColor.slice(1, 3), 16) || 0
  const g = parseInt(hexColor.slice(3, 5), 16) || 0
  const b = parseInt(hexColor.slice(5, 7), 16) || 0
  const op = Math.max(0, Math.min(1, opacity))
  const left = op
  const mid = op * (0.5 / 0.85)
  const right = op * (0.2 / 0.85)
  return `linear-gradient(90deg, rgba(${r},${g},${b},${left}) 0%, rgba(${r},${g},${b},${mid}) 60%, rgba(${r},${g},${b},${right}) 100%)`
}

export function HomeBannerCard() {
  const [banner, setBanner] = useState<Banner | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.rpc('get_random_home_banner').then(({ data }) => {
      if (cancelled) return
      setBanner((data as Banner | null) ?? null)
    })
    return () => { cancelled = true }
  }, [])

  if (!banner) return null

  function handleClick() {
    window.open(banner!.linkUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="home-section">
      <button type="button" className="home-banner-card" onClick={handleClick}>
        <img src={banner.imageUrl} alt="" className="home-banner-card-img" />
        <div
          className="home-banner-card-overlay"
          style={{ background: buildOverlayGradient(banner.overlayColor, banner.overlayOpacity) }}
          aria-hidden
        />
        <div className="home-banner-card-text">
          <span className="home-banner-card-tag" style={{ color: banner.tagColor }}>Boutique</span>
          <span className="home-banner-card-title" style={{ color: banner.titleColor }}>{banner.title}</span>
          {banner.subtitle && (
            <span className="home-banner-card-sub" style={{ color: banner.subtitleColor }}>{banner.subtitle}</span>
          )}
        </div>
      </button>
    </section>
  )
}
