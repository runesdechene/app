import { useEffect, useRef, useState } from 'react'

export type MapStyleMode = 'game' | 'detailed' | 'satellite'

const STYLE_OPTIONS: { mode: MapStyleMode; label: string; icon: string }[] = [
  { mode: 'game',      label: 'Jeu',       icon: '\uD83D\uDCDC' },  // 📜
  { mode: 'detailed',  label: 'Détaillé',  icon: '\uD83C\uDFD8\uFE0F' },  // 🏘️
  { mode: 'satellite', label: 'Satellite', icon: '\uD83D\uDEF0\uFE0F' },  // 🛰️
]

interface Props {
  mode: MapStyleMode
  onChange: (m: MapStyleMode) => void
  addPlaceMode: boolean
}

export function MapStyleSelect({ mode, onChange, addPlaceMode }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Fermer au clic extérieur
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const current = STYLE_OPTIONS.find(o => o.mode === mode)!

  return (
    <div
      ref={ref}
      className="map-style-select"
      style={addPlaceMode ? { bottom: 70 } : undefined}
    >
      {/* Dropdown (s'ouvre vers le haut) */}
      {open && (
        <div className="map-style-dropdown">
          {STYLE_OPTIONS.map(opt => (
            <button
              key={opt.mode}
              className={`map-style-option${opt.mode === mode ? ' active' : ''}`}
              onClick={() => { onChange(opt.mode); setOpen(false) }}
            >
              <span className="map-style-option-icon">{opt.icon}</span>
              <span className="map-style-option-label">{opt.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Bouton principal (icône layers) */}
      <button
        className="map-style-trigger"
        onClick={() => setOpen(!open)}
        title={`Style : ${current.label}`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      </button>
    </div>
  )
}
