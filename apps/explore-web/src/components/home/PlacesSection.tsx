import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
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

type Tab = 'recent' | 'nearby'

export function PlacesSection() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('recent')
  const [places, setPlaces] = useState<Place[]>([])
  const [loading, setLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)

  // Récupérer la geo une fois pour la tab Proches
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGeoError("La géolocalisation n'est pas disponible.")
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError('Active la géolocalisation pour voir les lieux proches.'),
      { timeout: 5000, maximumAge: 60000 }
    )
  }, [])

  // Fetcher selon le tab
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        if (tab === 'recent') {
          const { data, error } = await supabase.rpc('get_recent_places', { p_limit: 10 })
          if (!cancelled && !error) setPlaces((data ?? []) as Place[])
        } else if (tab === 'nearby' && userPos) {
          const { data, error } = await supabase.rpc('get_nearby_places', {
            p_lat: userPos.lat,
            p_lng: userPos.lng,
            p_limit: 10,
          })
          if (!cancelled && !error) setPlaces((data ?? []) as Place[])
        } else if (tab === 'nearby' && !userPos) {
          setPlaces([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tab, userPos])

  function handlePlaceClick(p: Place) {
    navigate(`/carte?placeId=${encodeURIComponent(p.id)}`)
  }

  return (
    <section className="places-section">
      <h2 className="places-section-title">Lieux</h2>
      <div className="places-section-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'recent'}
          className={`places-section-tab${tab === 'recent' ? ' active' : ''}`}
          onClick={() => setTab('recent')}
        >
          Nouveaux
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'nearby'}
          className={`places-section-tab${tab === 'nearby' ? ' active' : ''}`}
          onClick={() => setTab('nearby')}
        >
          Proches
        </button>
      </div>

      {tab === 'nearby' && geoError && !userPos && (
        <p className="places-section-fallback">{geoError}</p>
      )}

      {loading && <p className="places-section-loading">Chargement…</p>}

      {!loading && places.length === 0 && tab === 'recent' && (
        <p className="places-section-empty">Aucun lieu pour le moment.</p>
      )}

      <ul className="places-section-list">
        {places.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="places-section-card"
              onClick={() => handlePlaceClick(p)}
            >
              {p.image_url && (
                <img src={p.image_url} alt="" className="places-section-card-img" />
              )}
              <div className="places-section-card-body">
                <div className="places-section-card-title">{p.title}</div>
                {tab === 'nearby' && p.distance_km != null && (
                  <div className="places-section-card-sub">
                    {p.distance_km < 1
                      ? `${Math.round(p.distance_km * 1000)} m`
                      : `${p.distance_km.toFixed(1)} km`}
                  </div>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
