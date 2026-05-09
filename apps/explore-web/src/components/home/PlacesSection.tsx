import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useMapStore } from '../../stores/mapStore'
import './PlacesSection.css'

interface Place {
  id: string
  title: string
  slug: string | null
  latitude: number
  longitude: number
  image_url: string | null
  distance_km?: number
  created_at?: string
}

/**
 * Section Lieux de la home mobile.
 * Carrousel horizontal des 9 lieux à proximité (GPS) ou des 9 plus récents.
 * Priorité GPS (get_nearby_places) → fallback récents (get_recent_places).
 */
const LIMIT = 9

export function PlacesSection() {
  const setSelectedPlaceId = useMapStore((s) => s.setSelectedPlaceId)
  const [places, setPlaces] = useState<Place[]>([])
  const [loading, setLoading] = useState(true)
  const [subtitle, setSubtitle] = useState('Lieux à proximité')

  useEffect(() => {
    let cancelled = false

    function loadRecent() {
      supabase.rpc('get_recent_places', { p_limit: LIMIT }).then(({ data, error }) => {
        if (cancelled) return
        if (!error && data) setPlaces((data as Place[]).slice(0, LIMIT))
        setSubtitle('Lieux récents')
        setLoading(false)
      })
    }

    if (!('geolocation' in navigator)) {
      loadRecent()
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return
        supabase.rpc('get_nearby_places', {
          p_lat: pos.coords.latitude,
          p_lng: pos.coords.longitude,
          p_limit: LIMIT,
        }).then(({ data, error }) => {
          if (cancelled) return
          if (!error && data && (data as Place[]).length > 0) {
            setPlaces((data as Place[]).slice(0, LIMIT))
            setSubtitle('Lieux à proximité')
          } else {
            loadRecent()
            return
          }
          setLoading(false)
        })
      },
      () => {
        if (!cancelled) loadRecent()
      },
      { timeout: 4000, maximumAge: 60000 }
    )

    return () => {
      cancelled = true
    }
  }, [])

  function handlePlaceClick(p: Place) {
    // Ouvre la modale lieu sur la home (PlacePanel monté dans HomePage lit
    // useMapStore.selectedPlaceId), sans naviguer vers /carte.
    setSelectedPlaceId(p.id)
  }

  return (
    <section className="places-section">
      <h2 className="places-section-title">{subtitle}</h2>

      {loading && <p className="places-section-loading">Chargement…</p>}

      {!loading && places.length === 0 && (
        <p className="places-section-empty">Aucun lieu pour le moment.</p>
      )}

      {!loading && places.length > 0 && (
        <div className="places-section-scroll-wrapper">
          <div className="places-section-scroll">
            {places.map((p) => (
            <button
              key={p.id}
              type="button"
              className="places-section-card"
              onClick={() => handlePlaceClick(p)}
            >
              <div className="places-section-card-img-wrapper">
                {p.image_url ? (
                  <img src={p.image_url} alt="" />
                ) : (
                  <div className="places-section-card-placeholder">📍</div>
                )}
              </div>
              <div className="places-section-card-name">{p.title}</div>
              {p.distance_km != null && (
                <div className="places-section-card-sub">
                  {p.distance_km < 1
                    ? `${Math.round(p.distance_km * 1000)} m`
                    : `${p.distance_km.toFixed(1)} km`}
                </div>
              )}
            </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
