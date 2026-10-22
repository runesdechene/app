/**
 * QUOI     — un texte écrit par un Explorateur, ses liens https et ses @mentions cliquables.
 * POURQUOI — la présentation d'un profil et le récit d'un lieu affichent leurs liens pareil.
 *            Rend des morceaux, pas de bloc : le parent garde son paragraphe et son style.
 */
import { decouperLiens } from '@/shared/lib/liens'
import styles from './TexteAvecLiens.module.css'

export function TexteAvecLiens({ texte }: { texte: string }) {
  return decouperLiens(texte).map((m, i) =>
    m.type === 'lien' ? (
      <a key={i} className={styles.lien} href={m.href} target="_blank" rel="noreferrer">
        {m.valeur}
      </a>
    ) : (
      m.valeur
    ),
  )
}
