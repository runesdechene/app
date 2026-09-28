/**
 * QUOI     — le code à 6 chiffres (maquette 94:319) : six cases, « Renvoyer dans 42 s »,
 *            « Changer d'e-mail », puis « Entrer ».
 * POURQUOI — une seule saisie sous les six cases : le clavier numérique, le collage et le
 *            remplissage automatique du téléphone (one-time-code) marchent d'eux-mêmes. Le
 *            sixième chiffre entre tout seul.
 */
import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { envoyerCode } from '../api/entree'
import { useEntrer } from '../hooks/useEntrer'
import { useParcours } from '../hooks/useParcours'
import styles from './Code.module.css'
import commun from './Onboarding.module.css'
import { Page } from './Page'

const ATTENTE = 60 // secondes avant de pouvoir renvoyer un code

export function Code() {
  const { parcours, aller } = useParcours()
  const { entrer, enCours, codeRefuse } = useEntrer()
  const [code, setCode] = useState('')
  const [reste, setReste] = useState(ATTENTE)
  const renvoi = useMutation({
    mutationFn: () => envoyerCode(parcours.email ?? ''),
    onSuccess: () => {
      setReste(ATTENTE)
    },
  })

  useEffect(() => {
    if (reste === 0) return
    const minuteur = setTimeout(() => {
      setReste(reste - 1)
    }, 1000)
    return () => {
      clearTimeout(minuteur)
    }
  }, [reste])

  const saisir = (valeur: string) => {
    const chiffres = valeur.replace(/\D/g, '').slice(0, 6)
    setCode(chiffres)
    if (chiffres.length === 6) entrer(chiffres)
  }

  // Sans e-mail (un rechargement au milieu), on revient le demander.
  if (!parcours.email) {
    return (
      <Page avecRetour>
        <h1 className={commun.titre}>Regarde tes e-mails</h1>
        <button
          type="button"
          className={commun.principal}
          onClick={() => {
            aller('email', {}, true)
          }}
        >
          Indiquer mon e-mail
        </button>
      </Page>
    )
  }

  return (
    <Page
      avecRetour
      bas={
        <button
          type="button"
          className={commun.principal}
          disabled={code.length < 6 || enCours}
          onClick={() => {
            entrer(code)
          }}
        >
          Entrer
        </button>
      }
    >
      <h1 className={commun.titre}>Regarde tes e-mails</h1>
      <p className={commun.chapeau}>
        On vient d’envoyer un code à 6 chiffres à <strong>{parcours.email}</strong>
      </p>
      <div className={commun.champ}>
        <label className={commun.etiquette} htmlFor="code-champ">
          Ton code
        </label>
        <div className={styles.cases}>
          <input
            id="code-champ"
            className={styles.saisie}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => {
              saisir(e.target.value)
            }}
          />
          {Array.from({ length: 6 }, (_, i) => (
            <span
              key={i}
              className={i === code.length ? styles.caseActive : styles.case}
              aria-hidden="true"
            >
              {code[i] ?? ''}
            </span>
          ))}
        </div>
      </div>
      {codeRefuse && (
        <p role="alert" className={commun.alerte}>
          Ce code ne marche pas. Vérifie-le, ou demande-en un nouveau.
        </p>
      )}
      <div className={styles.liens}>
        <button
          type="button"
          className={styles.renvoyer}
          disabled={reste > 0 || renvoi.isPending}
          onClick={() => {
            renvoi.mutate()
          }}
        >
          {reste > 0 ? `Renvoyer dans ${String(reste)} s` : 'Renvoyer le code'}
        </button>
        <button
          type="button"
          className={styles.changer}
          onClick={() => {
            aller('email', {}, true)
          }}
        >
          Changer d’e-mail
        </button>
      </div>
      <p className={styles.indesirables}>Rien reçu ? Jette un œil aux indésirables.</p>
    </Page>
  )
}
