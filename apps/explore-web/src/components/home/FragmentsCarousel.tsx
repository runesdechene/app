import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import './FragmentsCarousel.css'

interface Fragment {
  id: number
  name: string
  icon: string | null
  icon_url: string | null
  image_url: string | null
  link_url: string | null
  collection: string | null
  owned: boolean
}

export function FragmentsCarousel() {
  const userId = usePlayerStore((s) => s.userId)
  const [fragments, setFragments] = useState<Fragment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await supabase.rpc('get_recent_fragments', {
          p_user_id: userId,
          p_limit: 10,
        })
        if (cancelled) return
        if (error) {
          console.warn('[FragmentsCarousel] get_recent_fragments failed', error)
          return
        }
        setFragments((data ?? []) as Fragment[])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  if (loading || fragments.length === 0) return null

  return (
    <section className="fragments-carousel">
      <h2 className="fragments-carousel-title">Fragments</h2>
      <div className="fragments-carousel-track">
        {fragments.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`fragments-carousel-card${f.owned ? ' owned' : ''}`}
            onClick={() => {
              if (f.link_url) window.open(f.link_url, '_blank', 'noopener,noreferrer')
            }}
          >
            <div className="fragments-carousel-img-wrapper">
              {f.image_url || f.icon_url ? (
                <img src={f.image_url ?? f.icon_url ?? ''} alt={f.name} />
              ) : (
                <div className="fragments-carousel-placeholder">{f.icon ?? '✦'}</div>
              )}
              {f.owned && <div className="fragments-carousel-owned-badge">✓</div>}
            </div>
            <div className="fragments-carousel-name">{f.name}</div>
          </button>
        ))}
      </div>
    </section>
  )
}
