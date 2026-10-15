/**
 * QUOI     — la frise des quatre étapes : verticale dans la colonne sombre (PC), en ligne en haut du
 *            formulaire (téléphone). L'étape en cours est pleine, les étapes faites sont cochées.
 * POURQUOI — le design de la page en ligne (ancien StudioSubmit), gardé par Uriel le 15/10. La frise
 *            en ligne double l'autre pour les yeux seulement : « Étape n sur 4 » le dit déjà.
 */
import { ETAPES } from './lib/formulaire'
import styles from './Frise.module.css'

export function Frise({ etape, sens }: { etape: number; sens: 'vertical' | 'horizontal' }) {
  return (
    <ol className={styles.frise} data-sens={sens} aria-hidden={sens === 'horizontal' ? true : undefined}>
      {ETAPES.map((nom, i) => {
        const n = i + 1
        const etat = n === etape ? 'en-cours' : n < etape ? 'faite' : 'a-venir'
        return (
          <li key={nom} className={styles.pas} data-etat={etat} aria-current={n === etape ? 'step' : undefined}>
            <span className={styles.numero}>{n < etape ? '✓' : n}</span>
            <span className={styles.nom}>{nom}</span>
          </li>
        )
      })}
    </ol>
  )
}
