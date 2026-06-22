import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useMapStore } from '../../../stores/mapStore'
import { usePlayerStore } from '../../../stores/playerStore'
import { useToastStore } from '../../../stores/toastStore'
import { MapCrosshairPicker } from '../shared/MapCrosshairPicker'
import './AddPlaceFlow.css'

type Step = 'position' | 'address' | 'submitting'

/**
 * Éditeur de position d'un lieu existant. Réutilise le mode plein écran
 * addPlaceMode (mapPickerPurpose === 'editPosition') et le viseur partagé.
 * Pré-centré sur la position actuelle du lieu (editPositionTarget). Édition
 * immédiate via RPC update_place_position (autorité serveur sur l'éligibilité).
 */
export function EditPositionFlow() {
  const target = useMapStore(s => s.editPositionTarget)
  const userId = usePlayerStore(s => s.userId)

  const [step, setStep] = useState<Step>('position')
  const [confirmedCoords, setConfirmedCoords] = useState<{ lat: number; lng: number } | null>(null)
  // Pré-rempli avec l'adresse actuelle ; le reverse-geocoding l'écrase en cas de
  // succès, mais on garde l'ancienne en filet si Nominatim échoue.
  const [address, setAddress] = useState(target?.address ?? '')
  const [error, setError] = useState<string | null>(null)
  const flyDoneRef = useRef(false)

  // Pré-centrage sur la position actuelle (une seule fois).
  useEffect(() => {
    if (flyDoneRef.current || !target) return
    flyDoneRef.current = true
    useMapStore.getState().setPendingNewPlaceCoords({ lng: target.lng, lat: target.lat })
    useMapStore.getState().requestFlyTo({ lng: target.lng, lat: target.lat })
  }, [target])

  function closeFlow() {
    const m = useMapStore.getState()
    m.setAddPlaceMode(false)
    m.setMapPickerPurpose('add')
    m.setEditPositionTarget(null)
    m.setPendingNewPlaceCoords(null)
  }

  function handlePositionConfirm(coords: { lat: number; lng: number }) {
    setConfirmedCoords(coords)
    setStep('address')
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json&accept-language=fr`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(data => { if (data?.display_name) setAddress(data.display_name) })
      .catch(err => console.warn('[EditPositionFlow] reverse-geocoding failed', err))
  }

  async function handleSubmit() {
    if (!userId || !target || !confirmedCoords) return
    const ok = window.confirm(
      'Confirmez-vous que cette position est exacte ? Elle remplace l\'actuelle pour tous les joueurs.'
    )
    if (!ok) return
    setStep('submitting')
    setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('update_place_position', {
        p_user_id: userId,
        p_place_id: target.placeId,
        p_latitude: confirmedCoords.lat,
        p_longitude: confirmedCoords.lng,
        p_address: address.trim(),
      })
      if (rpcError) { setError(rpcError.message); setStep('address'); return }
      if (data?.error === 'not_eligible' || data?.error === 'unauthorized') {
        setError('Tu n\'es pas autorisé à corriger ce lieu (auteur ou visiteur uniquement).')
        setStep('address'); return
      }
      if (data?.error === 'too_far') {
        const drift = typeof data.driftMeters === 'number' ? ` (${data.driftMeters} m demandés)` : ''
        setError(`La position doit rester à moins de 500 m du lieu d'origine${drift}. Reviens en arrière et rapproche le marqueur.`)
        setStep('address'); return
      }
      if (data?.error) { setError(data.error); setStep('address'); return }

      const m = useMapStore.getState()
      closeFlow()
      m.incrementPlacesRefreshKey()
      m.requestFlyTo({ lng: confirmedCoords.lng, lat: confirmedCoords.lat, placeId: target.placeId })
      useToastStore.getState().addToast({
        type: 'new_place',
        message: '📍 Position corrigée. Le marqueur a été déplacé.',
        timestamp: Date.now(),
        placeId: target.placeId,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setStep('address')
    }
  }

  if (!target) return null

  if (step === 'position') {
    return (
      <MapCrosshairPicker
        title="Corriger la position"
        confirmLabel="Valider"
        onConfirm={handlePositionConfirm}
        onCancel={closeFlow}
      />
    )
  }

  if (step === 'address') {
    return (
      <div className="add-place-form">
        <div className="add-place-form-header">
          <button className="add-place-back-btn" onClick={() => setStep('position')}>
            &#8592; Retour
          </button>
          <span className="add-place-step-title">Nouvelle adresse</span>
          <div style={{ width: 80 }} />
        </div>
        <div className="add-place-form-body">
          {error && <div className="add-place-error">{error}</div>}
          {confirmedCoords && (
            <>
              <div className="add-place-coords-display">
                Ancienne : {target.lat.toFixed(7)}, {target.lng.toFixed(7)}
              </div>
              <div className="add-place-coords-display">
                Nouvelle : {confirmedCoords.lat.toFixed(7)}, {confirmedCoords.lng.toFixed(7)}
              </div>
            </>
          )}
          <label className="add-place-label">Adresse</label>
          <input
            className="add-place-input"
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Adresse correspondant à la nouvelle position"
          />
        </div>
        <div className="add-place-form-footer">
          <button className="add-place-cancel-btn" onClick={closeFlow}>Annuler</button>
          <button className="add-place-submit-btn" onClick={handleSubmit}>
            Enregistrer la position
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="add-place-form">
      <div className="add-place-loading">
        <div className="add-place-spinner" />
        <span>Mise à jour de la position…</span>
      </div>
    </div>
  )
}
