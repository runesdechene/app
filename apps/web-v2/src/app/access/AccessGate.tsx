/**
 * QUOI     — la porte de la V2 : laisse passer, renvoie vers la V1, ou propose de réessayer.
 * POURQUOI — la V2 est réservée aux comptes autorisés pendant sa construction (spec socle §6).
 * ATTENTION — `leave` utilise location.replace : la V2 ne reste pas dans l'historique, donc le
 *            bouton retour de la V1 ne ramène pas vers une porte fermée.
 */
import { useEffect, type ReactNode } from 'react'
import { choisirLaV1 } from '@/shared/lib/ancienneExplore'
import { decideAccess } from './decideAccess'
import { useV2Access } from './useV2Access'
import styles from './AccessGate.module.css'

export const V1_URL = '/'

// Partir vers la V1, en défaisant le choix de la V2 : sinon la V1 renverrait ici, en boucle.
function leaveToV1() {
  choisirLaV1()
  window.location.replace(V1_URL)
}

export function AccessGate({
  children,
  leave = leaveToV1,
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
        <a className={styles.link} href={V1_URL} onClick={choisirLaV1}>
          Retour à la V1
        </a>
      </main>
    )
  }
  if (decision === 'wait') {
    // Jamais d'écran vide : la vérification peut prendre quelques secondes hors connexion.
    return (
      <main className={styles.offline} aria-busy="true">
        <p>Ouverture de la V2…</p>
      </main>
    )
  }
  // 'leave' : la redirection vers la V1 est en cours (effet ci-dessus).
  return null
}
