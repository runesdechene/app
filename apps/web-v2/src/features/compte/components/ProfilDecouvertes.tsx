/**
 * QUOI     — le bas du profil : ses découvertes en trois onglets.
 * POURQUOI — les listes arrivent exclusives de la base (Ajoutés > Visités > Envie d'y aller).
 *            `envies === null` : l'Explorateur les masque, l'onglet n'existe pas (ni vide, ni 0).
 */
import { useState } from 'react'
import { Onglets } from '@/shared/ui/Onglets'
import type { ExplorateurProfile, Lieu } from '../api/lireProfil'
import styles from './ProfilDecouvertes.module.css'

type Liste = 'ajoutes' | 'visites' | 'envies'

export function ProfilDecouvertes({ profil }: { profil: ExplorateurProfile }) {
  const [liste, setListe] = useState<Liste>('ajoutes')
  const onglets: { id: Liste; libelle: string; compte?: number }[] = [
    { id: 'ajoutes', libelle: 'Ajoutés', compte: profil.ajoutes.length },
    { id: 'visites', libelle: 'Visités', compte: profil.visites.length },
  ]
  if (profil.envies !== null) {
    onglets.push({ id: 'envies', libelle: 'Envie d’y aller', compte: profil.envies.length })
  }
  const lieux: Lieu[] = liste === 'envies' ? (profil.envies ?? []) : profil[liste]

  return (
    <section className={styles.decouvertes} aria-label="Ses découvertes">
      <h2 className={styles.titre}>Ses découvertes</h2>
      <Onglets onglets={onglets} actif={liste} onChange={setListe} />
      {lieux.length === 0 ? (
        <p className={styles.vide}>Rien ici pour l’instant.</p>
      ) : (
        <ul className={styles.grille}>
          {lieux.map((l) => (
            <li key={l.id} className={styles.lieu}>
              {l.imageUrl && <img src={l.imageUrl} alt="" loading="lazy" />}
              <span className={styles.nom}>{l.nom}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
