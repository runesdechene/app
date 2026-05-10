import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePlayerStore } from '../../stores/playerStore'
import './GeolocationPrompt.css'

/**
 * V0.7.7 (10/05) — modale d'invitation à activer la geoloc, affichée au
 * premier mount post-auth si la permission n'a jamais été décidée. Le clic
 * sur "Activer" sert de user gesture → prompt natif browser à coup sûr
 * (sans gesture, certains Android/iOS l'ignorent silencieusement).
 *
 * Affichage piloté via navigator.permissions.query (state === 'prompt'),
 * fallback aux navigateurs sans Permissions API : on affiche quand même
 * pour invitation explicite.
 *
 * "Plus tard" stocke un flag en sessionStorage pour ne pas re-afficher
 * pendant la session (re-demande au prochain lancement).
 */
const DISMISS_KEY = 'geoloc-prompt-dismissed'

export function GeolocationPrompt() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!navigator.geolocation) return
    if (sessionStorage.getItem(DISMISS_KEY) === '1') return

    if (typeof navigator.permissions === 'undefined') {
      setShow(true)
      return
    }

    let cancelled = false
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((p) => {
        if (cancelled) return
        if (p.state === 'prompt') {
          setShow(true)
        }
      })
      .catch(() => {
        if (!cancelled) setShow(true)
      })
    return () => { cancelled = true }
  }, [])

  if (!show) return null

  function activate() {
    setShow(false)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        usePlayerStore.getState().setUserPosition({
          lng: pos.coords.longitude,
          lat: pos.coords.latitude,
        })
      },
      () => { /* refus → silencieux */ },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    )
  }

  function later() {
    setShow(false)
    sessionStorage.setItem(DISMISS_KEY, '1')
  }

  return createPortal(
    <div className="geoloc-prompt-overlay" onClick={later}>
      <div className="geoloc-prompt-card" onClick={(e) => e.stopPropagation()}>
        <div className="geoloc-prompt-icon" aria-hidden>📍</div>
        <h3 className="geoloc-prompt-title">Active ta position</h3>
        <p className="geoloc-prompt-desc">
          Pour planter ton étendard sur les lieux que tu visites et révéler ce qui t'entoure
          sur la carte, Runes de Chêne a besoin de ta position GPS.
        </p>
        <p className="geoloc-prompt-hint">
          Tu pourras la désactiver à tout moment dans les réglages de ton téléphone.
        </p>
        <div className="geoloc-prompt-actions">
          <button className="geoloc-prompt-btn-primary" onClick={activate}>
            Activer ma position
          </button>
          <button className="geoloc-prompt-btn-secondary" onClick={later}>
            Plus tard
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
