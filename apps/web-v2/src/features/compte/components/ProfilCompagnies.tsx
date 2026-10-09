/**
 * QUOI     — les Compagnies d'un Explorateur, en gélules à leur couleur, qui mènent à leur fiche.
 * POURQUOI — montrer à quelles antennes on appartient (spec compagnies) ; une privée n'apparaît
 *            qu'à ses membres (la base le décide, migration 422).
 */
import { Link } from 'react-router'
import { teinteCompagnie } from '@/shared/lib/teinte'
import type { ExplorateurProfile } from '../api/lireProfil'
import styles from './ProfilCompagnies.module.css'

export function ProfilCompagnies({ profil }: { profil: ExplorateurProfile }) {
  if (profil.compagnies.length === 0) return null
  return (
    <ul className={styles.compagnies} aria-label="Ses Compagnies">
      {profil.compagnies.map((c) => (
        <li key={c.id}>
          <Link
            className={styles.gelule}
            style={teinteCompagnie(c.couleur)}
            to={`../../compagnie/${c.id}`}
            relative="path"
          >
            {c.nom}
          </Link>
        </li>
      ))}
    </ul>
  )
}
