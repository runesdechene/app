import { useState, useEffect } from 'react'
import { useMapStore } from '../../../stores/mapStore'
import { usePlayerStore } from '../../../stores/playerStore'

interface Props {
  title: string
  confirmLabel: string
  /** Coords confirmées (centre du viseur) au clic sur le bouton de confirmation */
  onConfirm: (coords: { lat: number; lng: number }) => void
  onCancel: () => void
}

/**
 * Viseur plein écran partagé : crosshair central fixe, la coordonnée vient du
 * centre de carte via mapStore.pendingNewPlaceCoords (alimenté par ExploreMap en
 * mode addPlaceMode). Extrait de l'étape "location" d'AddPlaceFlow (sprint
 * Purification — sous-composant partagé), consommé par AddPlaceFlow et
 * EditPositionFlow.
 */
export function MapCrosshairPicker({ title, confirmLabel, onConfirm, onCancel }: Props) {
  const coords = useMapStore(s => s.pendingNewPlaceCoords)
  const userPosition = usePlayerStore(s => s.userPosition)

  const [latInput, setLatInput] = useState('')
  const [lngInput, setLngInput] = useState('')
  const [coordsFocused, setCoordsFocused] = useState(false)

  // Sync inputs depuis le centre de carte (sauf pendant l'édition manuelle).
  useEffect(() => {
    if (coords && !coordsFocused) {
      setLatInput(coords.lat.toFixed(7))
      setLngInput(coords.lng.toFixed(7))
    }
  }, [coords, coordsFocused])

  function handleCoordsSubmit() {
    const lat = parseFloat(latInput)
    const lng = parseFloat(lngInput)
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      useMapStore.getState().requestFlyTo({ lng, lat })
      setCoordsFocused(false)
    }
  }

  function handleGPS() {
    if (userPosition) {
      useMapStore.getState().requestFlyTo({ lng: userPosition.lng, lat: userPosition.lat })
    }
  }

  return (
    <>
      <div className="add-place-top-bar">
        <button className="add-place-back-btn" onClick={onCancel}>
          &#8592; Retour
        </button>
        <span className="add-place-step-title">{title}</span>
        <button
          className="add-place-next-btn"
          onClick={() => coords && onConfirm({ lat: coords.lat, lng: coords.lng })}
          disabled={!coords}
        >
          {confirmLabel}
        </button>
      </div>

      <div className="add-place-crosshair">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="20" stroke="#ffffff" strokeWidth="6" strokeDasharray="4 3" opacity="0.6" />
          <circle cx="24" cy="24" r="7" fill="#ffffff" opacity="0.6" />
          <line x1="24" y1="0" x2="24" y2="16" stroke="#ffffff" strokeWidth="6" opacity="0.5" />
          <line x1="24" y1="32" x2="24" y2="48" stroke="#ffffff" strokeWidth="6" opacity="0.5" />
          <line x1="0" y1="24" x2="16" y2="24" stroke="#ffffff" strokeWidth="6" opacity="0.5" />
          <line x1="32" y1="24" x2="48" y2="24" stroke="#ffffff" strokeWidth="6" opacity="0.5" />
          <circle cx="24" cy="24" r="20" stroke="#4A3728" strokeWidth="2" strokeDasharray="4 3" opacity="0.7" />
          <circle cx="24" cy="24" r="4" fill="#4A3728" />
          <line x1="24" y1="0" x2="24" y2="16" stroke="#4A3728" strokeWidth="2" opacity="0.8" />
          <line x1="24" y1="32" x2="24" y2="48" stroke="#4A3728" strokeWidth="2" opacity="0.8" />
          <line x1="0" y1="24" x2="16" y2="24" stroke="#4A3728" strokeWidth="2" opacity="0.8" />
          <line x1="32" y1="24" x2="48" y2="24" stroke="#4A3728" strokeWidth="2" opacity="0.8" />
        </svg>
      </div>

      <div className="add-place-zoom-btns">
        <button className="add-place-zoom-btn" onClick={() => useMapStore.getState().requestZoom('in')}>+</button>
        <button className="add-place-zoom-btn" onClick={() => useMapStore.getState().requestZoom('out')}>&minus;</button>
      </div>

      <div className="add-place-bottom-bar">
        <button className="add-place-gps-btn" onClick={handleGPS} disabled={!userPosition}>
          📍 Ma position
        </button>
        <div className="add-place-coords-inputs">
          <label className="add-place-coord-label">Lat</label>
          <input
            className="add-place-coord-input"
            type="text"
            inputMode="decimal"
            value={latInput}
            onChange={e => setLatInput(e.target.value)}
            onFocus={() => setCoordsFocused(true)}
            onBlur={() => { setCoordsFocused(false); handleCoordsSubmit() }}
            onKeyDown={e => { if (e.key === 'Enter') { handleCoordsSubmit(); (e.target as HTMLInputElement).blur() } }}
            placeholder="43.7000"
          />
          <label className="add-place-coord-label">Lng</label>
          <input
            className="add-place-coord-input"
            type="text"
            inputMode="decimal"
            value={lngInput}
            onChange={e => setLngInput(e.target.value)}
            onFocus={() => setCoordsFocused(true)}
            onBlur={() => { setCoordsFocused(false); handleCoordsSubmit() }}
            onKeyDown={e => { if (e.key === 'Enter') { handleCoordsSubmit(); (e.target as HTMLInputElement).blur() } }}
            placeholder="7.2600"
          />
        </div>
      </div>
    </>
  )
}
