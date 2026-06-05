import type { SearchablePlace } from '../../../stores/searchFilterStore'
import './SearchResultsList.css'

interface SearchResultsListProps {
  results: SearchablePlace[]
  query: string
  onPick: (p: SearchablePlace) => void
}

/** Liste de résultats partagée par l'overlay plein écran (mobile) et le menu déroulant (desktop). */
export function SearchResultsList({ results, query, onPick }: SearchResultsListProps) {
  if (query.trim() && results.length === 0) {
    return <p className="search-results-empty">Aucun lieu trouvé.</p>
  }
  if (results.length === 0) return null

  return (
    <>
      <div className="search-results-group">Lieux · {results.length}</div>
      {results.map(p => (
        // onMouseDown + preventDefault : sur desktop, évite que l'input perde le focus
        // (blur → fermeture du menu) avant que le clic ne soit traité.
        <button
          key={p.id}
          className="search-results-row"
          onMouseDown={e => { e.preventDefault(); onPick(p) }}
        >
          <span className="search-results-ico">📍</span>
          <span className="search-results-text">
            <span className="search-results-title">{p.title}</span>
            {p.address && <span className="search-results-sub">{p.address}</span>}
          </span>
        </button>
      ))}
    </>
  )
}
