/**
 * QUOI     — le bouton du Hub : les quatre sortes du bouton de l'appli (apps/web-v2/src/shared/ui/Button),
 *            même dessin, mêmes jetons de la DA.
 * POURQUOI — sans brique, chaque écran du Hub s'inventait son bouton (contour, lien souligné…) :
 *            principal = la décision (« Retirer »), secondaire = contour, doux = action calme,
 *            discret = renoncer (« Annuler »).
 */
import type { ReactNode } from 'react'
import styles from './Bouton.module.css'

export type SorteDeBouton = 'principal' | 'secondaire' | 'doux' | 'discret'

export function Bouton({ sorte = 'principal', disabled = false, onClick, children }: {
  sorte?: SorteDeBouton
  disabled?: boolean
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <button type="button" className={styles[sorte]} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}
