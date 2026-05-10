import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import {
  type CalendarRef,
  CALENDAR_LABELS,
  toGregorian,
  toCalendar,
  formatYear,
  formatEraRange,
} from '../../../lib/calendarUtils'
import './EraSelector.css'

interface Era {
  id: string
  name: string
  year_start: number | null
  year_end: number | null
  sort_order: number
}

interface EraSelectorProps {
  eraId: string | null
  yearExact: number | null
  onChange: (eraId: string | null, yearExact: number | null) => void
  required?: boolean
}

export function EraSelector({ eraId, yearExact, onChange, required }: EraSelectorProps) {
  const [eras, setEras] = useState<Era[]>([])
  const [inputRef, setInputRef] = useState<CalendarRef>('gregorian')
  const [yearInput, setYearInput] = useState('')
  const [isBce, setIsBce] = useState(false)

  useEffect(() => {
    supabase
      .from('eras')
      .select('id, name, year_start, year_end, sort_order')
      .order('sort_order')
      .then(({ data }) => {
        if (data) setEras(data)
      })
  }, [])

  // Sync yearInput when yearExact changes externally
  useEffect(() => {
    if (yearExact !== null) {
      const converted = toCalendar(yearExact, inputRef)
      setYearInput(Math.abs(converted).toString())
      setIsBce(inputRef === 'gregorian' && yearExact < 0)
    } else {
      setYearInput('')
      setIsBce(false)
    }
  }, [yearExact, inputRef])

  function handleYearChange(raw: string) {
    setYearInput(raw)
    if (!raw.trim()) {
      onChange(eraId, null)
      return
    }
    const num = parseInt(raw, 10)
    if (isNaN(num)) return

    let refYear = num
    if (inputRef === 'gregorian' && isBce) refYear = -num
    const gregorian = toGregorian(refYear, inputRef)
    onChange(eraId, gregorian)
  }

  function handleBceToggle(bce: boolean) {
    setIsBce(bce)
    if (!yearInput.trim()) return
    const num = parseInt(yearInput, 10)
    if (isNaN(num)) return
    const gregorian = bce ? -num : num
    onChange(eraId, gregorian)
  }

  function handleRefChange(ref: CalendarRef) {
    setInputRef(ref)
    // yearInput will be resynced by the useEffect above
  }

  // Validation : date dans la fourchette de l'époque ?
  const selectedEra = eras.find(e => e.id === eraId)
  const yearWarning = (() => {
    if (yearExact === null || !selectedEra) return null
    const { year_start, year_end } = selectedEra
    if (year_start !== null && yearExact < year_start) return 'Date antérieure à cette époque'
    if (year_end !== null && yearExact > year_end) return 'Date postérieure à cette époque'
    return null
  })()

  return (
    <div className="era-selector">
      {/* Dropdown époque */}
      <label className="era-label">
        Époque {required && <span className="era-required">*</span>}
      </label>
      <select
        className="era-dropdown"
        value={eraId ?? ''}
        onChange={e => onChange(e.target.value || null, yearExact)}
      >
        <option value="" disabled>Choisir une époque...</option>
        {eras.map(era => (
          <option key={era.id} value={era.id}>
            {era.year_start === null && era.year_end === null
              ? era.name
              : `${era.name} — ${formatEraRange(era.year_start, era.year_end)}`}
          </option>
        ))}
      </select>

      {/* Date précise — masquée pour 'unknown' (Indéfinie) : pas de fourchette d'années */}
      {eraId && eraId !== 'unknown' && (
        <div className="era-date-section">
          <label className="era-label">
            Date précise <span className="era-optional">(optionnel)</span>
          </label>

          <div className="era-date-row">
            <input
              type="number"
              className="era-year-input"
              placeholder="Année"
              value={yearInput}
              onChange={e => handleYearChange(e.target.value)}
            />

            {/* Toggle av/ap J.-C. — masqué si AUC */}
            {inputRef === 'gregorian' && (
              <div className="era-bce-toggle">
                <button
                  type="button"
                  className={`era-bce-btn ${isBce ? 'active' : ''}`}
                  onClick={() => handleBceToggle(true)}
                >
                  av. J.-C.
                </button>
                <button
                  type="button"
                  className={`era-bce-btn ${!isBce ? 'active' : ''}`}
                  onClick={() => handleBceToggle(false)}
                >
                  ap. J.-C.
                </button>
              </div>
            )}
          </div>

          {/* Sélecteur référentiel */}
          <div className="era-ref-row">
            <span className="era-ref-label">Référentiel :</span>
            {(['gregorian', 'auc', 'constantinople'] as const).map(ref => (
              <button
                key={ref}
                type="button"
                className={`era-ref-btn ${inputRef === ref ? 'active' : ''}`}
                onClick={() => handleRefChange(ref)}
              >
                {CALENDAR_LABELS[ref]}
              </button>
            ))}
          </div>

          {/* Avertissement fourchette */}
          {yearWarning && (
            <p className="era-warning">{yearWarning}</p>
          )}

          {/* Équivalences */}
          {yearExact !== null && (
            <div className="era-equivalences">
              <span className="era-equiv-title">Équivalences</span>
              <div className="era-equiv-values">
                <span className="era-equiv-primary">
                  {formatYear(yearExact, 'gregorian')}
                </span>
                <span className="era-equiv-secondary">
                  {formatYear(yearExact, 'auc')}
                </span>
                <span className="era-equiv-secondary">
                  {formatYear(yearExact, 'constantinople')}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
