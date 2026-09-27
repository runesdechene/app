/**
 * QUOI     — la porte de la V2 : laisse passer, renvoie vers la V1, ou propose de réessayer.
 * POURQUOI — la V2 est réservée aux comptes autorisés pendant sa construction (spec socle §6).
 * ATTENTION — `leave` utilise location.replace : la V2 ne reste pas dans l'historique, donc le
 *            bouton retour de la V1 ne ramène pas vers une porte fermée.
 */
import { useEffect, type ReactNode } from 'react'
import { decideAccess } from './decideAccess'
import { useV2Access } from './useV2Access'
import styles from './AccessGate.module.css'

export const V1_URL = '/'

function leaveToV1() {
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
        <a className={styles.link} href={V1_URL}>
          Retour à la V1
        </a>
      </main>
    )
  }
  return null
}
