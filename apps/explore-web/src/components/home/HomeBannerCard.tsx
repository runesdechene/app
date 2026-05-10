import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import './HomeBannerCard.css'

interface Banner {
  id: number
  imageUrl: string
  title: string
  subtitle: string | null
  linkUrl: string
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
        <div className="home-banner-card-overlay" aria-hidden />
        <div className="home-banner-card-text">
          <span className="home-banner-card-tag">Boutique</span>
          <span className="home-banner-card-title">{banner.title}</span>
          {banner.subtitle && (
            <span className="home-banner-card-sub">{banner.subtitle}</span>
          )}
        </div>
      </button>
    </section>
  )
}
