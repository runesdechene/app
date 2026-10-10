/**
 * QUOI     — la pastille ♥ (maquette Figma « Lieu — aimer » A, 30/09) : chaque toucher envoie un
 *            cœur qui s'envole, rose quand j'en ai déjà envoyé. Sans droit d'en envoyer (son propre
 *            lieu, sa propre mise à jour), elle montre le compte et ouvre la liste.
 * POURQUOI — Uriel, 30/09 : « addictif comme pour les Activités » ; la même sur un lieu et sur une
 *            mise à jour (Uriel, 11/10 : « tout pareil »).
 */
import type { Coeurs } from '@/shared/lib/carnet'
import { useEnvols } from '@/shared/hooks/useEnvols'
import { Envols } from './Envols'
import styles from './PastilleCoeurs.module.css'

type Proprietes = {
  coeurs: Coeurs
  peutAimer: boolean
  onAimer: () => void
  onVoir: () => void
}

export function PastilleCoeurs({ coeurs, peutAimer, onAimer, onVoir }: Proprietes) {
  const { envols, lancer, finir } = useEnvols()
  if (!peutAimer) {
    if (coeurs.total === 0) return null
    return (
      <button
        type="button"
        className={styles.pastille}
        aria-label={`Voir les cœurs (${String(coeurs.total)})`}
        onClick={onVoir}
      >
        <span className={styles.coeur} aria-hidden="true" />
        {coeurs.total}
      </button>
    )
  }
  return (
    <button
      type="button"
      className={styles.pastille}
      aria-label={`Envoyer un cœur (${String(coeurs.total)})`}
      aria-pressed={coeurs.miens > 0}
      onClick={() => {
        onAimer()
        lancer()
      }}
    >
      <span className={styles.coeur} aria-hidden="true" />
      {coeurs.total > 0 && coeurs.total}
      <Envols envols={envols} onFin={finir} />
    </button>
  )
}
