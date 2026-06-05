import { useSearchFilterStore } from '../../../stores/searchFilterStore'
import { SearchOverlay } from './SearchOverlay'
import { FilterSheet } from '../filters/FilterSheet'
import './SearchBar.css'

export function SearchBar() {
  const openOverlay = useSearchFilterStore(s => s.openOverlay)
  const openSheet = useSearchFilterStore(s => s.openSheet)
  const tagIds = useSearchFilterStore(s => s.tagIds)
  const eraIds = useSearchFilterStore(s => s.eraIds)
  const progress = useSearchFilterStore(s => s.progress)

  const activeCount = tagIds.size + eraIds.size + (progress !== 'all' ? 1 : 0)

  return (
    <>
      <div className="map-search-bar">
        <button className="map-search-pill" onClick={openOverlay}>
          <span aria-hidden>🔍</span> Rechercher un lieu…
        </button>
        <button className="map-search-funnel" onClick={openSheet} aria-label="Filtres">
          <span aria-hidden>⚙︎</span>
          {activeCount > 0 && <span className="map-search-funnel-badge">{activeCount}</span>}
        </button>
      </div>
      <SearchOverlay />
      <FilterSheet />
    </>
  )
}
