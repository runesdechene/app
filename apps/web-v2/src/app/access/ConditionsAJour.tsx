/**
 * QUOI     — « Nos conditions évoluent » : une fenêtre à l'entrée de l'appli pour qui n'a pas
 *            accepté la version en vigueur des conditions et de la politique de confidentialité.
 *            Il coche, continue, et entre.
 * POURQUOI — Uriel, 11/10 : les représenter à tous, et qu'il faille les accepter pour accéder à
 *            l'appli. La base garde la version et la date (mig 498).
 * ATTENTION — hors connexion (lecture en échec), on laisse entrer : l'appli hors ligne ne se ferme
 *            pas pour une lecture manquée ; la fenêtre reviendra au prochain passage en ligne.
 */
import { useState, type ReactNode } from 'react'
import { useAccepterConditions, useMesConditions } from '@/shared/hooks/useConditions'
import { DATE_DES_CONDITIONS, VERSION_DES_CONDITIONS } from '@/shared/lib/conditions'
import styles from './ConditionsAJour.module.css'

export function ConditionsAJour({ children }: { children: ReactNode }) {
  const conditions = useMesConditions()
  const accepter = useAccepterConditions()
  const [coche, setCoche] = useState(false)

  if (conditions.isPending || conditions.isError || conditions.data === VERSION_DES_CONDITIONS) {
    return children
  }

  return (
    <div className={styles.voile}>
      <section
        className={styles.fenetre}
        role="dialog"
        aria-modal="true"
        aria-labelledby="conditions"
      >
        <h1 id="conditions" className={styles.titre}>
          Nos conditions évoluent
        </h1>
        <p>
          Nos conditions d’utilisation et notre politique de confidentialité ont changé le{' '}
          {DATE_DES_CONDITIONS}. Elles disent, en clair, ce que Runes de Chêne garde de toi, et te
          donnent la main : tu peux désormais télécharger tes données ou supprimer ton compte depuis
          les Préférences.
        </p>
        <label className={styles.case}>
          <input
            type="checkbox"
            checked={coche}
            onChange={(e) => {
              setCoche(e.target.checked)
            }}
          />
          <span>
            J’accepte les{' '}
            <a href="/legal/conditions" target="_blank" rel="noopener">
              conditions d’utilisation
            </a>{' '}
            et la{' '}
            <a href="/legal/confidentialite" target="_blank" rel="noopener">
              politique de confidentialité
            </a>
            .
          </span>
        </label>
        <button
          type="button"
          className={styles.continuer}
          disabled={!coche || accepter.isPending}
          onClick={() => {
            accepter.mutate(VERSION_DES_CONDITIONS)
          }}
        >
          Continuer
        </button>
        {accepter.isError && (
          <p role="alert" className={styles.alerte}>
            Ton accord n’a pas pu être enregistré. Vérifie ta connexion, puis réessaie.
          </p>
        )}
      </section>
    </div>
  )
}
