/**
 * QUOI     — le cadre d'un détail : titre, bouton fermer, contenu.
 * POURQUOI — même cadre partout ; la coquille décide s'il couvre l'écran (mobile) ou s'il
 *            s'ouvre en panneau (desktop), par CSS seulement.
 * ATTENTION — le focus va sur le titre à l'ouverture : un lecteur d'écran annonce le détail.
 *            `actions` : ce qui se range à droite du titre (les badges d'un profil, maquette 89:124).
 *            `avant` et `sousTitre` : un portrait avant le titre, une ligne sous lui (l'en-tête
 *            d'une conversation de Murmures, maquette 264:162) ; `plume` : le titre en IM Fell,
 *            comme un nom écrit à la main (la même conversation).
 *            `surImage` : le contenu commence par une photo pleine largeur (la fiche d'un lieu) —
 *            la flèche claire se pose dessus, le titre n'est plus visible mais reste annoncé.
 *            Sur PC, cette flèche ne s'affiche que si un écran du tiroir est derrière
 *            (`data-retour`, voir shared/lib/retour.ts).
 */
import { useEffect, useRef, type ReactNode } from 'react'
import flecheRetourClaire from '@/assets/ui/fleche-retour-claire.svg'
import { useLocation } from 'react-router'
import flecheRetour from '@/assets/ui/fleche-retour.svg'
import { venuDUnEcran } from '@/shared/lib/retour'
import { useFermerDetail } from '../navigation/useFermerDetail'
import styles from './DetailPane.module.css'

export function DetailPane({
  title,
  actions,
  surImage = false,
  avant,
  sousTitre,
  plume = false,
  onFermer,
  children,
}: {
  title: string
  actions?: ReactNode
  surImage?: boolean
  avant?: ReactNode | undefined
  sousTitre?: string | undefined
  plume?: boolean
  // Un écran qui a quelque chose à perdre ferme lui-même (« Abandonner tes changements ? ») :
  // sa flèche reste alors visible partout, sur PC compris.
  onFermer?: () => void
  children: ReactNode
}) {
  const fermerParDefaut = useFermerDetail()
  const fermer = onFermer ?? fermerParDefaut
  const retour = venuDUnEcran(useLocation().state) || onFermer !== undefined
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    heading.current?.focus()
  }, [])

  return (
    <aside
      className={[styles.pane, surImage && styles.surImage].filter(Boolean).join(' ')}
      aria-labelledby="detail-title"
      data-detail
      data-retour={retour || undefined}
    >
      <header className={styles.header}>
        <button type="button" className={styles.close} onClick={fermer} aria-label="Fermer">
          <img src={surImage ? flecheRetourClaire : flecheRetour} alt="" width={24} height={24} />
        </button>
        {avant}
        <div className={styles.titres}>
          <h1
            id="detail-title"
            ref={heading}
            tabIndex={-1}
            className={[styles.title, surImage && styles.masque, plume && styles.plume]
              .filter(Boolean)
              .join(' ')}
          >
            {title}
          </h1>
          {sousTitre && <p className={styles.sousTitre}>{sousTitre}</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
      <div className={styles.body}>{children}</div>
    </aside>
  )
}
