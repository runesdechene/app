/**
 * QUOI     — « Un compte au stand » : l'équipe crée le compte d'un client rencontré en festival (e-mail,
 *            prénom, newsletter), puis ouvre sa fiche pour lui associer ses Fragments.
 * POURQUOI — la newsletter n'est cochée que si le client l'accepte à voix haute (L34-5 CPCE) : la case
 *            part décochée. La fonction Netlify ne tourne pas en local : l'erreur s'affiche sous le formulaire.
 */
import { useState, type SyntheticEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Tiroir } from '@/shared/ui/Tiroir'
import { useCreerCompteDuStand } from '../hooks/useCompteDuStand'
import styles from './Communaute.module.css'

const LISTE = '/communaute/comptes'

export function TiroirCompteDuStand() {
  const naviguer = useNavigate()
  const { search } = useLocation()
  const creer = useCreerCompteDuStand()
  const [email, setEmail] = useState('')
  const [prenom, setPrenom] = useState('')
  const [newsletter, setNewsletter] = useState(false)
  const [refus, setRefus] = useState<string | null>(null)

  function envoyer(e: SyntheticEvent) {
    e.preventDefault()
    creer.reset()
    if (!email.includes('@')) {
      setRefus('Une adresse e-mail est nécessaire.')
      return
    }
    setRefus(null)
    creer.mutate(
      { email: email.trim(), prenom: prenom.trim(), newsletter },
      { onSuccess: (id) => { void naviguer({ pathname: `${LISTE}/${id}`, search }) } },
    )
  }

  return (
    <Tiroir titre="Un compte au stand" retour={LISTE + search}>
      <form className={styles.formulaire} onSubmit={envoyer} noValidate>
        <label className={styles.champ}>E-mail
          <input type="email" value={email} onChange={(e) => { setEmail(e.target.value) }} />
        </label>
        <label className={styles.champ}>Prénom
          <input value={prenom} onChange={(e) => { setPrenom(e.target.value) }} />
          <span>Facultatif : il personnalise l’e-mail de bienvenue de la boutique.</span>
        </label>
        <label className={styles.caseACocher}>
          <input type="checkbox" checked={newsletter} onChange={(e) => { setNewsletter(e.target.checked) }} />
          Il veut recevoir la newsletter
        </label>
        <p className={styles.calme}>À lui demander : sans son accord, pas de newsletter.</p>
        <div>
          <button type="submit" className={styles.boutonContour} disabled={creer.isPending}>
            {creer.isPending ? 'Création…' : 'Créer le compte'}
          </button>
        </div>
        {refus && <p role="alert">{refus}</p>}
        {creer.isError && <p role="alert">{creer.error.message}</p>}
      </form>
    </Tiroir>
  )
}
