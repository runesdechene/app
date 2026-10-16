/**
 * QUOI     — l'encart rouge pâle d'une erreur (Figma 606:1535) : l'icône d'alerte et le texte.
 * POURQUOI — role="alert" : un lecteur d'écran l'annonce dès qu'il paraît.
 */
import type { ReactNode } from 'react'
import alerte from '@/assets/ui/alerte.svg'
import styles from './MessageDErreur.module.css'

export function MessageDErreur({ children }: { children: ReactNode }) {
  return (
    <p className={styles.message} role="alert">
      <img src={alerte} alt="" width={18} height={18} />
      <span>{children}</span>
    </p>
  )
}
