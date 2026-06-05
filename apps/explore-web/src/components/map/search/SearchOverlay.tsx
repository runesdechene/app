import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchFilterStore, type SearchablePlace } from '../../../stores/searchFilterStore'
import { useMapStore } from '../../../stores/mapStore'
import { searchPlaces } from '../../../lib/placeSearch'
import './SearchOverlay.css'

export function SearchOverlay() {
  const open = useSearchFilterStore(s => s.overlayOpen)
  const close = useSearchFilterStore(s => s.closeOverlay)
  const places = useSearchFilterStore(s => s.places)
  const [query, setQuery] = useState('')

  if (!open) return null

  const results = searchPlaces(places, query, 20)

  function pick(p: SearchablePlace) {
    useMapStore.getState().requestFlyTo({ lng: p.lng, lat: p.lat, placeId: p.id })
    useMapStore.getState().setSelectedPlaceId(p.id)
    setQuery('')
    close()
  }

  return createPortal(
    <div className="search-overlay">
      <div className="search-overlay-top">
        <input
          className="search-overlay-input"
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher un lieu…"
          aria-label="Rechercher un lieu"
        />
        <button className="search-overlay-cancel" onClick={() => { setQuery(''); close() }}>
          Annuler
        </button>
      </div>

      <div className="search-overlay-results">
        {query.trim() && results.length === 0 && (
          <p className="search-overlay-empty">Aucun lieu trouvé.</p>
        )}
        {results.length > 0 && (
          <>
            <div className="search-overlay-group">Lieux · {results.length}</div>
            {results.map(p => (
              <button key={p.id} className="search-overlay-row" onClick={() => pick(p)}>
                <span className="search-overlay-ico">📍</span>
                <span className="search-overlay-text">
                  <span className="search-overlay-title">{p.title}</span>
                  {p.address && <span className="search-overlay-sub">{p.address}</span>}
                </span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
