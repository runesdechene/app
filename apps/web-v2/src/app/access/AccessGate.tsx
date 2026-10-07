/**
 * QUOI     — la porte de l'appli : laisse passer, envoie à la vitrine (/bienvenue) qui n'a pas de
 *            session, ou propose de réessayer hors connexion.
 * POURQUOI — depuis la bascule (spec 2026-10-07), il n'y a plus de V1 vers qui renvoyer.
 * ATTENTION — `leave` utilise location.replace : la page refusée ne reste pas dans l'historique,
 *            le bouton retour ne ramène pas vers une porte fermée.
 */
import { useEffect, type ReactNode } from 'react'
import { decideAccess } from './decideAccess'
import { useV2Access } from './useV2Access'
import styles from './AccessGate.module.css'

function allerALaVitrine() {
  window.location.replace(`${import.meta.env.BASE_URL}bienvenue`)
}

export function AccessGate({
  children,
  leave = allerALaVitrine,
}: {
  children: ReactNode
  leave?: () => void
}) {
  const { state, retry } = useV2Access()
  const decision = decideAccess(state)

  useEffect(() => {
    if (decision === 'leave') leave()
  }, [decision, leave])

  if (decision === 'allow') return children
  if (decision === 'retry') {
    return (
      <main className={styles.offline}>
        <p>Hors connexion — impossible de vérifier ton accès.</p>
        <button type="button" className={styles.button} onClick={retry}>
          Réessayer
        </button>
      </main>
    )
  }
  if (decision === 'wait') {
    // Jamais d'écran vide : la vérification peut prendre quelques secondes hors connexion.
    return (
      <main className={styles.offline} aria-busy="true">
        <p>Ouverture…</p>
      </main>
    )
  }
  // 'leave' : le départ vers la vitrine est en cours (effet ci-dessus).
  return null
}
