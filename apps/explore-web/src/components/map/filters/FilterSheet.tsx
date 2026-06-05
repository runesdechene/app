import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  useSearchFilterStore, placeMatchesFilters, type ProgressFilter,
} from '../../../stores/searchFilterStore'
import './FilterSheet.css'

const PROGRESS_OPTIONS: { value: ProgressFilter; label: string }[] = [
  { value: 'all', label: 'Tout' },
  { value: 'undiscovered', label: '✨ À explorer' },
  { value: 'discovered', label: '✓ Découverts' },
]

export function FilterSheet() {
  const open = useSearchFilterStore(s => s.sheetOpen)
  const close = useSearchFilterStore(s => s.closeSheet)
  const loadTaxonomies = useSearchFilterStore(s => s.loadTaxonomies)
  const tags = useSearchFilterStore(s => s.tags)
  const eras = useSearchFilterStore(s => s.eras)
  const places = useSearchFilterStore(s => s.places)
  const tagIds = useSearchFilterStore(s => s.tagIds)
  const eraIds = useSearchFilterStore(s => s.eraIds)
  const progress = useSearchFilterStore(s => s.progress)
  const toggleTag = useSearchFilterStore(s => s.toggleTag)
  const toggleEra = useSearchFilterStore(s => s.toggleEra)
  const setProgress = useSearchFilterStore(s => s.setProgress)
  const resetFilters = useSearchFilterStore(s => s.resetFilters)

  useEffect(() => { if (open) void loadTaxonomies() }, [open, loadTaxonomies])

  if (!open) return null

  const criteria = { tagIds, eraIds, progress }
  const matchCount = places.filter(p => placeMatchesFilters(p, criteria)).length

  return createPortal(
    <div className="filter-sheet-backdrop" onClick={close}>
      <div className="filter-sheet" onClick={e => e.stopPropagation()}>
        <div className="filter-sheet-grab" />
        <div className="filter-sheet-head">
          <h4>Filtrer la carte</h4>
          <div className="filter-sheet-head-actions">
            <button className="filter-sheet-reset" onClick={resetFilters}>Réinitialiser</button>
            <button className="filter-sheet-close" onClick={close} aria-label="Fermer les filtres">✕</button>
          </div>
        </div>

        <div className="filter-sheet-body">
          <div className="filter-fam">🏷️ Tags · {tags.length}</div>
          <div className="filter-row">
            {tags.map(t => {
              const on = tagIds.has(t.id)
              return (
                <button
                  key={t.id}
                  className={`filter-chip${on ? ' on' : ''}`}
                  style={on
                    ? { background: t.color, color: '#fff', borderColor: t.color }
                    : { background: t.background, color: t.color, borderColor: t.color }}
                  onClick={() => toggleTag(t.id)}
                >
                  {t.icon && (
                    <span
                      className="filter-chip-ico"
                      style={{ maskImage: `url("${t.icon}")`, WebkitMaskImage: `url("${t.icon}")` }}
                    />
                  )}
                  {t.title}
                </button>
              )
            })}
          </div>

          <div className="filter-fam">✨ Ma progression</div>
          <div className="filter-row">
            {PROGRESS_OPTIONS.map(o => (
              <button
                key={o.value}
                className={`filter-toggle${progress === o.value ? ' on' : ''}`}
                onClick={() => setProgress(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>

          <div className="filter-fam">⏳ Époque · {eras.length}</div>
          <div className="filter-row">
            {eras.map(e => {
              const on = eraIds.has(e.id)
              return (
                <button
                  key={e.id}
                  className={`filter-chip era${on ? ' on' : ''}`}
                  onClick={() => toggleEra(e.id)}
                >
                  {e.name}
                </button>
              )
            })}
          </div>
        </div>

        <div className="filter-sheet-foot">
          <button className="filter-sheet-cta" onClick={close}>Voir les {matchCount} lieux</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
