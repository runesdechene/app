/**
 * QUOI     — le bouton de la V2, en quatre sortes : principal, secondaire, doux, discret.
 * POURQUOI — relevé dans la maquette : principal = « Marquer ma visite » (fiche lieu),
 *            secondaire = contour, discret = lien d'action (« Lire ou écouter ce fragment »).
 *            doux = « Envoyer un murmure » du profil (maquette COMPTE), pleine largeur.
 *            L'état désactivé est celui de « Marquer ma visite (274 km, trop loin) ».
 *            Avec `href`, c'est un lien vers un autre site (« Acheter ce Fragment »), ouvert à côté.
 */
import type { ReactNode } from 'react'
import styles from './Button.module.css'

export type ButtonKind = 'principal' | 'secondaire' | 'doux' | 'discret'

export function Button({
  kind = 'principal',
  disabled = false,
  onClick,
  href,
  children,
}: {
  kind?: ButtonKind
  disabled?: boolean
  onClick?: () => void
  href?: string
  children: ReactNode
}) {
  if (href) {
    return (
      <a className={[styles[kind], styles.lien].join(' ')} href={href} target="_blank" rel="noopener">
        {children}
      </a>
    )
  }
  return (
    <button type="button" className={styles[kind]} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}
