/**
 * QUOI     — le bas du profil : ses fragments, puis ses découvertes en trois onglets.
 * POURQUOI — les listes arrivent exclusives de la base (Ajoutés > Visités > Envie d'y aller).
 *            `envies === null` : l'Explorateur les masque, l'onglet n'existe pas (ni vide, ni 0).
 */
import { useState } from 'react'
import { Onglets } from '@/shared/ui/Onglets'
import { Text } from '@/shared/ui/Text'
import type { ExplorateurProfile, Lieu } from '../api/lireProfil'
import styles from './ProfilDecouvertes.module.css'

type Liste = 'ajoutes' | 'visites' | 'envies'

export function ProfilDecouvertes({ profil }: { profil: ExplorateurProfile }) {
  const [liste, setListe] = useState<Liste>('ajoutes')
  const onglets: { id: Liste; libelle: string; compte?: number }[] = [
    { id: 'ajoutes', libelle: 'Ajoutés', compte: profil.ajoutes.length },
    { id: 'visites', libelle: 'Visités', compte: profil.visites.length },
  ]
  if (profil.envies !== null) onglets.push({ id: 'envies', libelle: 'Envie d’y aller' })
  const lieux: Lieu[] = liste === 'envies' ? (profil.envies ?? []) : profil[liste]

  return (
    <>
      {profil.fragments.length > 0 && (
        <section className={styles.fragments} aria-label="Ses fragments">
          <Text variant="rubrique">Ses fragments</Text>
          <div className={styles.rangee}>
            {profil.fragments.map((f) => (
              <figure key={f.id} className={styles.fragment}>
                {f.imageUrl && <img src={f.imageUrl} alt="" />}
                <figcaption>{f.nom}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className={styles.decouvertes} aria-label="Ses découvertes">
        <Text variant="titre-section">Ses découvertes</Text>
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
    </>
  )
}
