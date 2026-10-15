/**
 * QUOI     — l'icône d'une culture, teintée de sa couleur.
 * POURQUOI — l'icône est un masque : seule sa forme compte, la couleur vient de la culture.
 */
import type { CSSProperties } from 'react'
import styles from './Cultures.module.css'

export function IconeDeCulture({ icone, couleur }: { icone: string | null; couleur: string | null }) {
  if (!icone) return <span className={styles.icone} />
  return <span className={styles.icone} style={{ '--couleur': couleur ?? 'currentColor', '--icone': `url(${icone})` } as CSSProperties} />
}
