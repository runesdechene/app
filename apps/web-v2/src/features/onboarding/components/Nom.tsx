/**
 * QUOI     — « Comment on t'appelle ? » (maquette 94:372) : le nom que les autres verront, et
 *            les Fragments que l'e-mail vient de rapporter.
 * POURQUOI — pas de retour ici : on est entré, on ne revient pas au code.
 */
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import vetement from '@/assets/onboarding/vetement.svg'
import { nommer } from '../api/entree'
import { useParcours } from '../hooks/useParcours'
import { enLettres, majuscule } from '../lib/enLettres'
import styles from './Onboarding.module.css'
import { Page, Suivant } from './Page'

export function Nom() {
  const { parcours, aller } = useParcours()
  const [nom, setNom] = useState('')
  const enregistrer = useMutation({
    mutationFn: () => nommer(nom.trim()),
    onSuccess: () => {
      aller('calendrier')
    },
  })
  const n = parcours.fragments

  return (
    <Page
      bas={
        <Suivant
          disabled={nom.trim() === '' || enregistrer.isPending}
          onClick={() => {
            enregistrer.mutate()
          }}
        />
      }
    >
      <h1 className={styles.titre}>Comment on t’appelle ?</h1>
      <p className={styles.chapeau}>
        C’est le nom que les autres membres verront sur la carte et au Campement.
      </p>
      <div className={styles.champ}>
        <label className={styles.etiquette} htmlFor="nom-champ">
          Ton nom
        </label>
        <input
          id="nom-champ"
          className={styles.saisie}
          autoComplete="nickname"
          maxLength={40}
          value={nom}
          onChange={(e) => {
            setNom(e.target.value)
          }}
        />
        <p className={styles.precision}>Prénom, surnom, comme tu veux. Tu pourras le changer.</p>
      </div>
      {enregistrer.isError && (
        <p role="alert" className={styles.alerte}>
          Ce nom n’a pas pu être enregistré. Réessaie dans un instant.
        </p>
      )}
      {n > 0 && (
        <div className={styles.encart}>
          <img src={vetement} alt="" width={22} height={22} />
          <p className={styles.encartTitre}>
            {majuscule(enLettres(n))} {n > 1 ? 'Fragments t’attendent' : 'Fragment t’attend'}
          </p>
          <p className={styles.encartTexte}>
            Achetés avec <strong>{parcours.email}</strong>, {n > 1 ? 'ils sont' : 'il est'} déjà
            dans ton profil.
          </p>
        </div>
      )}
      <p className={styles.note}>Ta photo pourra venir plus tard, depuis ton profil.</p>
    </Page>
  )
}
