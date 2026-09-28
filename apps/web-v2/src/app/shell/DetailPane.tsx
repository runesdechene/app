/**
 * QUOI     — le cadre d'un détail : titre, bouton fermer, contenu.
 * POURQUOI — même cadre partout ; la coquille décide s'il couvre l'écran (mobile) ou s'il
 *            s'ouvre en panneau (desktop), par CSS seulement.
 * ATTENTION — le focus va sur le titre à l'ouverture : un lecteur d'écran annonce le détail.
 *            `actions` : ce qui se range à droite du titre (les badges d'un profil, maquette 89:124).
 *            `surImage` : le contenu commence par une photo pleine largeur (la fiche d'un lieu) —
 *            la flèche claire se pose dessus, le titre n'est plus visible mais reste annoncé.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import flecheRetourClaire from '@/assets/ui/fleche-retour-claire.svg'
import flecheRetour from '@/assets/ui/fleche-retour.svg'
import { useFermerDetail } from '../navigation/useFermerDetail'
import styles from './DetailPane.module.css'

export function DetailPane({
  title,
  actions,
  surImage = false,
  children,
}: {
  title: string
  actions?: ReactNode
  surImage?: boolean
  children: ReactNode
}) {
  const fermer = useFermerDetail()
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    heading.current?.focus()
  }, [])

  return (
    <aside
      className={[styles.pane, surImage && styles.surImage].filter(Boolean).join(' ')}
      aria-labelledby="detail-title"
    >
      <header className={styles.header}>
        <button type="button" className={styles.close} onClick={fermer} aria-label="Fermer">
          <img src={surImage ? flecheRetourClaire : flecheRetour} alt="" width={24} height={24} />
        </button>
        <h1
          id="detail-title"
          ref={heading}
          tabIndex={-1}
          className={[styles.title, surImage && styles.masque].filter(Boolean).join(' ')}
        >
          {title}
        </h1>
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
      <div className={styles.body}>{children}</div>
    </aside>
  )
}
