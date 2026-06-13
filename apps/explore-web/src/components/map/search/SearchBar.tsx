import { useState } from 'react'
import { useSearchFilterStore, type SearchablePlace } from '../../../stores/searchFilterStore'
import { useMapStore } from '../../../stores/mapStore'
import { useIsDesktop } from '../../../hooks/useMediaQuery'
import { searchPlaces } from '../../../lib/placeSearch'
import { SearchResultsList } from './SearchResultsList'
import { SearchOverlay } from './SearchOverlay'
import { FilterSheet } from '../filters/FilterSheet'
import { MapStyleSelect } from '../controls/MapStyleSelect'
import './SearchBar.css'

export function SearchBar() {
  const isDesktop = useIsDesktop()
  const openOverlay = useSearchFilterStore(s => s.openOverlay)
  const openSheet = useSearchFilterStore(s => s.openSheet)
  const closeSheet = useSearchFilterStore(s => s.closeSheet)
  const sheetOpen = useSearchFilterStore(s => s.sheetOpen)
  const places = useSearchFilterStore(s => s.places)
  const tagIds = useSearchFilterStore(s => s.tagIds)
  const eraIds = useSearchFilterStore(s => s.eraIds)
  const progress = useSearchFilterStore(s => s.progress)

  const activeCount = tagIds.size + eraIds.size + (progress !== 'all' ? 1 : 0)

  // État local du champ desktop (le mobile passe par l'overlay plein écran).
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)

  function pick(p: SearchablePlace) {
    useMapStore.getState().requestFlyTo({ lng: p.lng, lat: p.lat, placeId: p.id })
    useMapStore.getState().setSelectedPlaceId(p.id)
    setQuery('')
    setFocused(false)
  }

  const showDropdown = isDesktop && focused && query.trim().length > 0
  const desktopResults = showDropdown ? searchPlaces(places, query, 12) : []

  return (
    <>
      <div className="map-search-bar">
        {isDesktop ? (
          <div className="map-search-inputwrap">
            <span className="map-search-input-ico" aria-hidden>🔍</span>
            <input
              className="map-search-input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Rechercher un lieu…"
              aria-label="Rechercher un lieu"
            />
            {showDropdown && (
              <div className="map-search-dropdown">
                <SearchResultsList results={desktopResults} query={query} onPick={pick} />
              </div>
            )}
          </div>
        ) : (
          <button className="map-search-pill" onClick={openOverlay}>
            <span aria-hidden>🔍</span> Rechercher un lieu…
          </button>
        )}

        <button
          className="map-search-funnel"
          onClick={() => (sheetOpen ? closeSheet() : openSheet())}
          aria-label="Filtres"
        >
          <span aria-hidden>⚙︎</span>
          {activeCount > 0 && <span className="map-search-funnel-badge">{activeCount}</span>}
        </button>

        {/* Bouton calques (style de carte) — à droite du filtre, même style. */}
        <MapStyleSelect />
      </div>

      {!isDesktop && <SearchOverlay />}
      <FilterSheet />
    </>
  )
}
