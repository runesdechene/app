/**
 * QUOI     — sous les liens de /flyer, l'inscription à la newsletter : un e-mail, un bouton.
 * POURQUOI — le dépliant n'offre plus de code (Uriel, 01/11) : cette porte garde ceux qui ne veulent
 *            pas de l'appli. Le formulaire ne sert qu'à s'inscrire : l'envoyer, c'est l'accord demandé
 *            (L34-5 CPCE), pas besoin de case.
 */
import { useState, type SubmitEvent } from 'react'
import { Bouton } from '../briques/Bouton'
import { Champ } from '../briques/Champ'
import { MessageDErreur } from '../briques/MessageDErreur'
import { inscrireALaNewsletter } from '../cadeau/api'
import styles from './Newsletter.module.css'

const DONNEES_PERSONNELLES = 'https://app.runesdechene.com/legal/confidentialite'
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function Newsletter() {
  const [email, setEmail] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [inscrit, setInscrit] = useState(false)

  const adresse = email.trim().toLowerCase()
  const valide = EMAIL.test(adresse)

  async function envoyer(e: SubmitEvent) {
    e.preventDefault()
    if (!valide || envoi) return
    setEnvoi(true)
    setErreur(null)
    try {
      await inscrireALaNewsletter(adresse)
      setInscrit(true)
    } catch (err) {
      setErreur(err instanceof Error ? err.message : String(err))
    } finally {
      setEnvoi(false)
    }
  }

  if (inscrit) {
    return (
      <section className={styles.bloc} aria-live="polite">
        <h2 className={styles.titre}>C’est noté</h2>
        <p className={styles.texte}>Tu seras prévenu du prochain Fragment. À bientôt, Compagnon !</p>
      </section>
    )
  }

  return (
    <form className={styles.bloc} onSubmit={(e) => void envoyer(e)} noValidate>
      <h2 className={styles.titre}>Être prévenu du prochain Fragment</h2>
      <Champ
        libelle="Ton e-mail"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="ton@email.fr"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value)
        }}
        disabled={envoi}
      />
      {erreur && <MessageDErreur>{erreur}</MessageDErreur>}
      <Bouton type="submit" disabled={!valide || envoi}>
        {envoi ? 'Un instant…' : 'M’inscrire'}
      </Bouton>
      <p className={styles.pied}>
        Nouveaux Fragments et ventes privées. Désinscription en un clic.{' '}
        <a href={DONNEES_PERSONNELLES}>Données personnelles</a>
      </p>
    </form>
  )
}
