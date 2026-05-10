import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePlayerStore } from '../../stores/playerStore'
import { useGeolocPromptStore } from '../../stores/geolocPromptStore'
import './GeolocationPrompt.css'

/**
 * V0.7.7 (10/05) — modale d'invitation à la geoloc, gère 3 états :
 *
 * - 'prompt'  → invitation classique avec bouton "Activer" (déclenche
 *               le prompt natif via user gesture)
 * - 'denied'  → tu as refusé, voici comment réactiver dans les paramètres
 * - 'granted' → ta position est déjà active (visible uniquement quand
 *               l'utilisateur ouvre manuellement via ProfileMenu)
 *
 * Auto-affichée au mount sur 'prompt'. Pour 'denied' / 'granted', l'ouverture
 * se fait via useGeolocPromptStore.open() (bouton ProfileMenu).
 */
const DISMISS_KEY = 'geoloc-prompt-dismissed'

type PermState = 'prompt' | 'granted' | 'denied' | 'unknown'

export function GeolocationPrompt() {
  const [state, setState] = useState<PermState>('unknown')
  const [autoShown, setAutoShown] = useState(false)
  const forceOpen = useGeolocPromptStore((s) => s.forceOpen)
  const closeForce = useGeolocPromptStore((s) => s.close)

  // Lecture de l'état permission + abonnement aux changements
  useEffect(() => {
    if (!navigator.geolocation) {
      setState('unknown')
      return
    }
    if (typeof navigator.permissions === 'undefined') {
      setState('prompt')
      return
    }

    let cancelled = false
    let permRef: PermissionStatus | null = null
    const onChange = () => {
      if (!cancelled && permRef) setState(permRef.state as PermState)
    }
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((p) => {
        if (cancelled) return
        permRef = p
        setState(p.state as PermState)
        p.addEventListener('change', onChange)
      })
      .catch(() => {
        if (!cancelled) setState('prompt')
      })
    return () => {
      cancelled = true
      if (permRef) permRef.removeEventListener('change', onChange)
    }
  }, [])

  // Auto-show une fois si la geoloc n'est pas activée (prompt OU denied) et
  // pas dismissed cette session. V0.7.7 (10/05) : 'denied' inclus aussi —
  // sinon l'utilisateur qui a refusé une fois ne voit jamais de relance, alors
  // que c'est précisément le moment où il faut lui dire "voici comment réactiver".
  // V0.8.2 (11/05) : on attend que la query permission soit RÉSOLUE — sinon
  // 'unknown' déclenche l'affichage avant la vraie valeur, et la modal flashe
  // une fraction de seconde avant de disparaître si la geoloc est en fait
  // 'granted'. On exclut donc 'unknown' du déclenchement auto.
  useEffect(() => {
    if (autoShown) return
    if (state !== 'prompt' && state !== 'denied') return
    if (sessionStorage.getItem(DISMISS_KEY) === '1') return
    setAutoShown(true)
  }, [state, autoShown])

  const visible = forceOpen || (autoShown && state !== 'granted')
  if (!visible) return null

  // V0.7.7 (10/05) — toute fermeture marque dismissed en sessionStorage.
  // Sinon le re-mount du composant à chaque changement de page recoche
  // l'auto-show et l'utilisateur tourne en boucle s'il ne veut pas du GPS.
  // Le flag est nettoyé au lancement de session (sessionStorage volatile).
  function close() {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setAutoShown(false)
    closeForce()
  }

  // Alias gardé pour la lisibilité du JSX ("Plus tard" / "Fermer").
  const later = close

  function activate() {
    // Pas de dismiss ici : si l'utilisateur valide le prompt natif on veut
    // que la modale "granted" s'auto-ouvre la prochaine fois que ProfileMenu
    // déclenche l'open manuel. Sinon dans la session courante, plus rien
    // n'apparaît tant qu'il ne change pas de pas.
    setAutoShown(false)
    closeForce()
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        usePlayerStore.getState().setUserPosition({
          lng: pos.coords.longitude,
          lat: pos.coords.latitude,
        })
      },
      () => { /* refus → silencieux, l'event 'change' rebascule l'état */ },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    )
  }

  return createPortal(
    <div className="geoloc-prompt-overlay" onClick={close}>
      <div className="geoloc-prompt-card" onClick={(e) => e.stopPropagation()}>
        <button className="geoloc-prompt-close" onClick={close} aria-label="Fermer">✕</button>
        <div className="geoloc-prompt-icon" aria-hidden>📍</div>

        {state === 'granted' && (
          <>
            <h3 className="geoloc-prompt-title">Position déjà active</h3>
            <p className="geoloc-prompt-desc">
              Ta position GPS est partagée avec Runes de Chêne. Tu peux planter ton étendard,
              découvrir les lieux autour de toi et révéler la carte.
            </p>
            <p className="geoloc-prompt-hint">
              Pour la désactiver : Paramètres du téléphone → Applications → Runes de Chêne → Autorisations → Position.
            </p>
            <div className="geoloc-prompt-actions">
              <button className="geoloc-prompt-btn-primary" onClick={close}>OK</button>
            </div>
          </>
        )}

        {state === 'denied' && (
          <>
            <h3 className="geoloc-prompt-title">Active ta position GPS</h3>
            <p className="geoloc-prompt-desc">
              L'accès à ta position est désactivé. Deux moyens de la réactiver :
            </p>
            <ol className="geoloc-prompt-steps">
              <li>
                <strong>Réglages du téléphone</strong> (le plus simple) — Paramètres → Applications →
                Runes de Chêne (ou Chrome) → Autorisations → Position → Autoriser. Vérifie aussi
                que le GPS du téléphone lui-même est activé (icône GPS dans le panneau rapide).
              </li>
              <li>
                <strong>Depuis le navigateur</strong> — touche le cadenas (ou ⋮) à côté de l'URL en haut,
                puis Autorisations → Position → Autoriser.
              </li>
            </ol>
            <div className="geoloc-prompt-actions">
              <button className="geoloc-prompt-btn-primary" onClick={activate}>
                Réessayer
              </button>
              <button className="geoloc-prompt-btn-secondary" onClick={close}>
                Fermer
              </button>
            </div>
          </>
        )}

        {(state === 'prompt' || state === 'unknown') && (
          <>
            <h3 className="geoloc-prompt-title">Active ta position</h3>
            <p className="geoloc-prompt-desc">
              Pour planter ton étendard sur les lieux que tu visites et révéler ce qui t'entoure
              sur la carte, Runes de Chêne a besoin de ta position GPS. Active le GPS sur ton téléphone.
            </p>
            <p className="geoloc-prompt-hint">
              Tu pourras la désactiver plus tard. Si cela ne marche pas, vérifie les réglages de tes applications ou de ton navigateur.
            </p>
            <div className="geoloc-prompt-actions">
              <button className="geoloc-prompt-btn-primary" onClick={activate}>
                Réessayer
              </button>
              <button className="geoloc-prompt-btn-secondary" onClick={later}>
                Plus tard
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
