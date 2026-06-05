import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchFilterStore, type SearchablePlace } from '../../../stores/searchFilterStore'
import { useMapStore } from '../../../stores/mapStore'
import { searchPlaces } from '../../../lib/placeSearch'
import { SearchResultsList } from './SearchResultsList'
import './SearchOverlay.css'

/** Overlay plein écran de recherche de lieux — MOBILE uniquement (le desktop tape
 *  directement dans la barre via un menu déroulant, cf. SearchBar). */
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
        <SearchResultsList results={results} query={query} onPick={pick} />
      </div>
    </div>,
    document.body,
  )
}
