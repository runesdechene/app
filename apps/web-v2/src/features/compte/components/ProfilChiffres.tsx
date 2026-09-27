/**
 * QUOI     — le bandeau de chiffres sous les titres : lieux ajoutés, visités, fragments.
 * POURQUOI — maquette 123:107 : ce qu'un Explorateur a accompli, lisible d'un coup d'œil avant
 *            même de faire défiler. Les chiffres viennent des listes déjà reçues.
 */
import type { ExplorateurProfile } from '../api/lireProfil'
import styles from './ProfilChiffres.module.css'

function accorder(n: number, un: string, plusieurs: string): string {
  return n > 1 ? plusieurs : un
}

export function ProfilChiffres({ profil }: { profil: ExplorateurProfile }) {
  const chiffres = [
    [profil.ajoutes.length, accorder(profil.ajoutes.length, 'Lieu ajouté', 'Lieux ajoutés')],
    [profil.visites.length, accorder(profil.visites.length, 'Lieu visité', 'Lieux visités')],
    [profil.fragments.length, accorder(profil.fragments.length, 'Fragment', 'Fragments')],
  ] as const
  return (
    <ul className={styles.chiffres} aria-label="En chiffres">
      {chiffres.map(([n, libelle]) => (
        <li key={libelle} className={styles.chiffre}>
          <span className={styles.nombre}>{n}</span>
          <span className={styles.libelle}>{libelle}</span>
        </li>
      ))}
    </ul>
  )
}
