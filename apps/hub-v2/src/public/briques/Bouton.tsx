/**
 * QUOI     — le bouton rouge des pages publiques (maquette Public/Bouton, Principal 604:1433), en
 *            bouton ou en lien (« J'en profite sur la boutique »).
 * POURQUOI — type="button" par défaut : un bouton de formulaire ne soumet que si on le demande.
 */
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react'
import styles from './Bouton.module.css'

export function Bouton({ type = 'button', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={className ? `${styles.bouton ?? ''} ${className}` : styles.bouton} {...props} />
}

export function LienBouton({ className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a className={className ? `${styles.bouton ?? ''} ${className}` : styles.bouton} {...props} />
}
