/**
 * QUOI     — le cartouche « Nouveau ici ? » sous le titre du Codex (maquette B, 05/11) : ce qu'est
 *            le Codex en deux lignes, le lien vers « Comment ça marche ? », une croix pour le fermer.
 * POURQUOI — qui découvre l'appli sans connaître la marque doit comprendre d'où viennent les
 *            Fragments ; qui a compris le ferme (Uriel, 05/11).
 */
import { Text } from '@/shared/ui/Text'
import { LienExplication } from './CommentCaMarche'
import styles from './NouveauIci.module.css'

export function NouveauIci({
  onFermer,
  onExpliquer,
}: {
  onFermer: () => void
  onExpliquer: () => void
}) {
  return (
    <aside className={styles.cartouche} aria-label="Nouveau ici ?">
      <div className={styles.tete}>
        <Text variant="titre-carte">Nouveau ici ?</Text>
        <button type="button" className={styles.fermer} aria-label="Fermer" onClick={onFermer}>
          <span className={styles.croix} aria-hidden="true" />
        </button>
      </div>
      <ul className={styles.lignes}>
        <li>Tes Fragments achetés sur la boutique arrivent ici d’eux-mêmes.</li>
        <li>
          Tu croises un t-shirt Runes de Chêne ? Scanne son motif : il entre dans ton Codex, avec
          une anecdote.
        </li>
      </ul>
      <LienExplication onClick={onExpliquer} />
    </aside>
  )
}
