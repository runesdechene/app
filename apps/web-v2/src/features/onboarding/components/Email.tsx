/**
 * QUOI     — l'e-mail (maquette 94:276) : on y envoie un code, pas de mot de passe.
 * POURQUOI — l'adresse d'une commande relie les achats au compte : on le dit à ceux qui ont
 *            déjà un vêtement. Un refus d'envoi se dit sous le champ, jamais en silence.
 */
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import vetement from '@/assets/onboarding/vetement.svg'
import { envoyerCode } from '../api/entree'
import { useParcours } from '../hooks/useParcours'
import styles from './Onboarding.module.css'
import { Page } from './Page'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function Email() {
  const { parcours, aller } = useParcours()
  const [email, setEmail] = useState(parcours.email ?? '')
  const envoi = useMutation({
    mutationFn: () => envoyerCode(email.trim()),
    onSuccess: () => {
      aller('code', { email: email.trim() })
    },
  })
  const valide = EMAIL.test(email.trim())

  return (
    <Page
      avecRetour
      bas={
        <button
          type="submit"
          form="email"
          className={styles.principal}
          disabled={!valide || envoi.isPending}
        >
          Recevoir mon code
        </button>
      }
    >
      <h1 className={styles.titre}>Ton adresse e-mail</h1>
      <p className={styles.chapeau}>
        On t’y envoie un code pour entrer.
        <br />
        Pas de mot de passe à retenir.
      </p>
      <form
        id="email"
        className={styles.champ}
        onSubmit={(e) => {
          e.preventDefault()
          if (valide) envoi.mutate()
        }}
      >
        <label className={styles.etiquette} htmlFor="email-champ">
          Ton e-mail
        </label>
        <input
          id="email-champ"
          className={styles.saisie}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
          }}
        />
      </form>
      {envoi.isError && (
        <p role="alert" className={styles.alerte}>
          Le code n’a pas pu partir. Vérifie l’adresse, puis réessaie.
        </p>
      )}
      <p className={styles.aide}>
        <img src={vetement} alt="" width={18} height={18} />
        Tu as déjà un vêtement Runes de Chêne ? Mets l’adresse de ta commande : c’est elle qui relie
        tes achats à ton compte.
      </p>
    </Page>
  )
}
