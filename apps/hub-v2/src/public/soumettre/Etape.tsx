/**
 * QUOI     — les pièces communes aux quatre étapes : l'en-tête (« Étape n sur 4 », le titre, le
 *            chapô), la barre du bas (« ← Précédent », le bouton d'action) et le bouton sombre.
 * POURQUOI — chaque étape ne garde que son formulaire ; la mise en page reste la même d'une étape à
 *            l'autre, comme sur l'ancienne page.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { ETAPES } from './lib/formulaire'
import styles from './Etape.module.css'

export function EnTete({ n, titre, children }: { n: number; titre: string; children?: ReactNode }) {
  return (
    <header className={styles.enTete}>
      <p className={styles.numero}>
        Étape {n} sur {ETAPES.length}
      </p>
      <h2 className={styles.titre}>{titre}</h2>
      {children && <p className={styles.chapo}>{children}</p>}
    </header>
  )
}

export function Navigation({ precedent, children }: { precedent?: () => void; children: ReactNode }) {
  return (
    <div className={styles.navigation}>
      {precedent ? (
        <button type="button" className={styles.precedent} onClick={precedent}>
          ← Précédent
        </button>
      ) : (
        <span />
      )}
      {children}
    </div>
  )
}

export function BoutonSombre({ envoi = false, ...props }: { envoi?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={styles.sombre} data-envoi={envoi} {...props} />
}
