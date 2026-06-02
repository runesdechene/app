import { useState } from 'react'
import { searchShopifyProducts, type ShopifyProductHit } from '../../lib/shopifyProducts'

interface MissionProductPickerProps {
  value: string | null
  onChange: (handle: string | null) => void
}

export function MissionProductPicker({ value, onChange }: MissionProductPickerProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ShopifyProductHit[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  async function handleSearch() {
    if (query.trim().length < 2) return
    setSearching(true)
    setSearchError(null)
    setSearched(false)
    try {
      const hits = await searchShopifyProducts(query.trim())
      setResults(hits)
      setSearched(true)
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Erreur de recherche')
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      void handleSearch()
    }
  }

  return (
    <div className="mission-product-picker">
      {value ? (
        <div className="mission-product-linked">
          <span className="mission-product-linked-label">Produit lié :</span>
          <code className="mission-product-handle">{value}</code>
          <button
            type="button"
            className="mission-product-unlink"
            onClick={() => {
              onChange(null)
              setResults([])
              setSearched(false)
              setQuery('')
            }}
          >
            Retirer
          </button>
        </div>
      ) : (
        <div className="mission-product-search-row">
          <input
            type="text"
            className="faction-create-input"
            placeholder="Rechercher un produit Shopify..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={searching}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="faction-create-btn"
            onClick={() => void handleSearch()}
            disabled={searching || query.trim().length < 2}
          >
            {searching ? '...' : 'Rechercher'}
          </button>
        </div>
      )}

      {searchError && (
        <p className="mission-product-error" style={{ color: '#c0392b', fontSize: 13, marginTop: 4 }}>
          {searchError}
        </p>
      )}

      {searched && !value && (
        <div className="mission-product-results">
          {results.length === 0 ? (
            <p style={{ fontSize: 13, opacity: 0.6, padding: '8px 0' }}>Aucun produit trouvé.</p>
          ) : (
            results.map(hit => (
              <button
                key={hit.productId}
                type="button"
                className="mission-product-result-item"
                onClick={() => {
                  onChange(hit.handle)
                  setResults([])
                  setSearched(false)
                  setQuery('')
                }}
              >
                {hit.imageUrl && (
                  <img
                    src={hit.imageUrl}
                    alt=""
                    className="mission-product-result-img"
                    style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, marginRight: 8, flexShrink: 0 }}
                  />
                )}
                <span className="mission-product-result-info">
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{hit.title}</span>
                  <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 8 }}>{hit.handle}</span>
                  {hit.price && (
                    <span style={{ fontSize: 12, marginLeft: 8, color: '#8A7B6A' }}>{hit.price}</span>
                  )}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
