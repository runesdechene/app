/**
 * QUOI     — le cadre d'un détail : titre, bouton fermer, contenu.
 * POURQUOI — même cadre partout ; la coquille décide s'il couvre l'écran (mobile) ou s'il
 *            s'ouvre en panneau (desktop), par CSS seulement.
 * ATTENTION — le focus va sur le titre à l'ouverture : un lecteur d'écran annonce le détail.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { useFermerDetail } from '../navigation/useFermerDetail'
import styles from './DetailPane.module.css'

export function DetailPane({ title, children }: { title: string; children: ReactNode }) {
  const fermer = useFermerDetail()
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    heading.current?.focus()
  }, [])

  return (
    <aside className={styles.pane} aria-labelledby="detail-title">
      <header className={styles.header}>
        <button type="button" className={styles.close} onClick={fermer} aria-label="Fermer">
          ←
        </button>
        <h1 id="detail-title" ref={heading} tabIndex={-1} className={styles.title}>
          {title}
        </h1>
      </header>
      <div className={styles.body}>{children}</div>
    </aside>
  )
}
