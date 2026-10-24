/**
 * QUOI     — « Nouveau compte » au stand (maquette 634:1568) : l'adresse tapée, le prénom, l'accord pour
 *            la newsletter, son anniversaire (facultatif), les Fragments choisis d'avance, et un seul bouton qui crée tout.
 * POURQUOI — le compte se crée par stand-create-account (client Shopify, puis compte de l'appli), puis
 *            chaque Fragment choisi s'associe. La newsletter part décochée : elle se demande à voix
 *            haute (L34-5 CPCE). La fonction Netlify ne tourne pas en local : son erreur s'affiche.
 */
import { useState, type SyntheticEvent } from 'react'
import { messageDErreur } from '@/shared/lib/erreur'
import { associerFragment } from '../api/fragmentsDuCompte'
import { poserAnniversaire } from '../api/sesMissives'
import { useCreerCompteDuStand } from '../hooks/useCompteDuStand'
import { useFragmentsAssociables } from '../hooks/useFragmentsDuCompte'
import { GrilleDeFragments } from './GrilleDeFragments'
import styles from './AssocierUnFragment.module.css'

const MOTS = { oui: 'Choisi', non: 'Choisir' }
/** Les jours d'un mois d'une année bissextile (le 29 février existe) ; 31 tant que le mois n'est pas choisi. */
const joursDuMois = (mois: string) => (mois ? new Date(2024, Number(mois), 0).getDate() : 31)
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

export function NouveauCompte({ email, onCree }: { email: string; onCree: (id: string) => void }) {
  const { data: tous = [] } = useFragmentsAssociables()
  const creer = useCreerCompteDuStand()
  const [prenom, setPrenom] = useState('')
  const [newsletter, setNewsletter] = useState(false)
  const [jour, setJour] = useState('')
  const [mois, setMois] = useState('')
  const [choisis, setChoisis] = useState<Set<number>>(new Set())
  const [refus, setRefus] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  function basculer(id: number) {
    const suite = new Set(choisis)
    if (suite.has(id)) suite.delete(id)
    else suite.add(id)
    setChoisis(suite)
  }

  async function creerEtAssocier() {
    setRefus(null)
    setEnCours(true)
    try {
      const id = await creer.mutateAsync({ email, prenom: prenom.trim(), newsletter })
      // Un Fragment refusé : on reste ici, le message le dit ; renvoyer est sans risque (la
      // fonction rend le compte déjà créé).
      try {
        for (const fragment of choisis) await associerFragment(id, fragment)
        // Après les Fragments : un anniversaire refusé ne les empêche pas. Le jour sans le mois ne dit rien.
        if (jour && mois) await poserAnniversaire(id, Number(jour), Number(mois))
        onCree(id)
      } catch (e) {
        setRefus(`Compte créé, mais la suite n’a pas pu s’enregistrer : ${messageDErreur(e)}`)
      }
    } catch (e) {
      setRefus(messageDErreur(e))
    } finally {
      setEnCours(false)
    }
  }

  function envoyer(e: SyntheticEvent) {
    e.preventDefault()
    void creerEtAssocier()
  }

  const nom = prenom.trim() || 'ce client'
  const combien = choisis.size === 0 ? '' : ` · ${String(choisis.size)} Fragment${choisis.size > 1 ? 's' : ''}`
  return (
    <form className={styles.fiche} aria-label="Nouveau compte" onSubmit={envoyer}>
      <div className={styles.tete}>
        <span className={styles.grandPortrait} />
        <div className={styles.qui}>
          <h2 className={styles.nomClient}>Nouveau compte</h2>
          <span className={styles.detail}>{email}</span>
        </div>
      </div>
      <label className={styles.champPrenom}>
        <span className={styles.libelle}>Son prénom</span>
        <input value={prenom} required autoComplete="off" autoCapitalize="words" onChange={(e) => { setPrenom(e.target.value) }} />
      </label>
      <div className={styles.anniversaire}>
        <span className={styles.libelle}>Son anniversaire (facultatif)</span>
        <select aria-label="Jour" value={jour} onChange={(e) => { setJour(e.target.value) }}>
          <option value="">Jour</option>
          {Array.from({ length: joursDuMois(mois) }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
        </select>
        <select
          aria-label="Mois"
          value={mois}
          onChange={(e) => {
            setMois(e.target.value)
            if (Number(jour) > joursDuMois(e.target.value)) setJour('')
          }}
        >
          <option value="">Mois</option>
          {MOIS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
      </div>
      <label className={styles.accord}>
        <input type="checkbox" checked={newsletter} onChange={(e) => { setNewsletter(e.target.checked) }} />
        Accepte les nouvelles de Runes de Chêne (à lui demander)
      </label>
      <button type="submit" className={styles.boutonPlein} disabled={enCours || prenom.trim() === ''}>
        {enCours ? 'Création…' : `Créer le compte de ${nom}${combien}`}
      </button>
      {refus && <p role="alert" className={styles.alerte}>{refus}</p>}

      <div className={styles.titreFragments}>
        <h3>Ses Fragments</h3>
        <span className={styles.detail}>Choisis-les dès maintenant : ils s’activent avec le compte</span>
      </div>
      <GrilleDeFragments fragments={tous} choisis={choisis} mots={MOTS} enCours={enCours} onToucher={basculer} />
    </form>
  )
}
