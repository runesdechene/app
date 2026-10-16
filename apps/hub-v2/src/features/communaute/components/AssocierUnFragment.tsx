/**
 * QUOI     — « Associer un Fragment », la page du stand sur tablette (maquettes 631:1524 et 634:1568) :
 *            un grand champ, les fins d'e-mail à toucher, les clients trouvés, puis la fiche du client
 *            choisi (ses achats, ses Fragments) ou la création de son compte avec l'adresse tapée.
 * POURQUOI — le geste le plus courant du stand (Uriel, 16/10). Le client choisi (compte) et la
 *            création (nouveau) sont dans l'adresse ; le texte du champ reste dans la page, pour que
 *            chaque lettre ne réécrive pas l'historique.
 */
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import loupe from '@/assets/ui/loupe.svg'
import { EnTeteDePage } from '@/shared/ui/EnTeteDePage'
import type { Compte } from '../api/comptes'
import { useComptes } from '../hooks/useComptes'
import { adresseComplete, finirAdresse, FINS } from '../lib/email'
import { FicheDuClient } from './FicheDuClient'
import { NouveauCompte } from './NouveauCompte'
import styles from './AssocierUnFragment.module.css'

const ATTENTE = 300
const RESULTATS = 8

export function AssocierUnFragment({ maintenant = new Date() }: { maintenant?: Date }) {
  const [params, setParams] = useSearchParams()
  const compte = params.get('compte')
  const nouveau = params.has('nouveau')
  const [texte, setTexte] = useState('')
  const [recherche, setRecherche] = useState('')

  // On cherche après 300 ms de calme, pas à chaque lettre.
  useEffect(() => {
    const minuteur = setTimeout(() => { setRecherche(texte.trim()) }, ATTENTE)
    return () => { clearTimeout(minuteur) }
  }, [texte])

  const { data, isError } = useComptes({
    filtre: 'tous', recherche, provenance: null, departement: null, tri: 'nom', limite: RESULTATS, decalage: 0,
  }, recherche.length >= 2)
  const lignes = recherche.length >= 2 ? (data?.lignes ?? []) : []
  const adresse = texte.trim().toLowerCase()
  const dejaPrise = lignes.some((c) => c.email?.toLowerCase() === adresse)
  const peutCreer = adresseComplete(adresse) && recherche === texte.trim() && data !== undefined && !dejaPrise

  function ecrire(t: string) {
    setTexte(t)
    if (compte || nouveau) setParams({}, { replace: true })
  }

  return (
    <div className={styles.ecran}>
      <EnTeteDePage surtitre="Fragments et boutique" titre="Associer un Fragment"
        phrase="Au stand : tape l’e-mail du client, vérifie qui il est, active ses Fragments." />

      <div className={styles.grandChamp}>
        <img src={loupe} alt="" />
        <input type="search" aria-label="Prénom ou e-mail du client" placeholder="Prénom ou e-mail du client"
          value={texte} autoComplete="off" autoCapitalize="none" spellCheck={false} inputMode="email"
          onChange={(e) => { ecrire(e.target.value) }} />
        {peutCreer ? (
          <button type="button" className={styles.boutonPlein} onClick={() => { setParams({ nouveau: '1' }) }}>Créer ce compte</button>
        ) : texte !== '' && (
          <button type="button" className={styles.boutonDoux} onClick={() => { ecrire('') }}>Effacer</button>
        )}
      </div>

      <div className={styles.fins} aria-label="Finir l’adresse">
        {FINS.map((fin) => (
          <button key={fin} type="button" className={styles.fin} onClick={() => { ecrire(finirAdresse(texte, fin)) }}>{fin}</button>
        ))}
      </div>

      <div className={styles.corps}>
        <div className={styles.resultats}>
          {recherche.length >= 2 && (
            <p className={styles.libelle}>
              {isError ? 'La base ne répond pas' : lignes.length === 0 ? 'Aucun compte' : `${String(lignes.length)} ${lignes.length > 1 ? 'clients trouvés' : 'client trouvé'}`}
            </p>
          )}
          {lignes.map((c) => <CarteClient key={c.id} compte={c} choisi={c.id === compte} onChoisir={() => { setParams({ compte: c.id }) }} />)}
          {peutCreer && lignes.length === 0 && (
            <p className={styles.aucun}>
              <strong>Personne n’a encore l’adresse {adresse}.</strong>
              Vérifie l’orthographe avec le client, puis crée son compte : il recevra l’e-mail de bienvenue de la boutique.
            </p>
          )}
        </div>

        {compte ? (
          <FicheDuClient key={compte} id={compte} maintenant={maintenant} />
        ) : nouveau && adresseComplete(adresse) ? (
          <NouveauCompte key={adresse} email={adresse} onCree={(id) => { setParams({ compte: id }) }} />
        ) : (
          <p className={styles.attente}>Tape l’e-mail du client, puis choisis-le, ou crée son compte.</p>
        )}
      </div>
    </div>
  )
}

function CarteClient({ compte, choisi, onChoisir }: { compte: Compte; choisi: boolean; onChoisir: () => void }) {
  const fragments = compte.fragments === 1 ? '1 Fragment' : `${String(compte.fragments)} Fragments`
  return (
    <button type="button" className={styles.carte} aria-pressed={choisi} onClick={onChoisir}>
      {compte.avatar ? <img className={styles.portrait} src={compte.avatar} alt="" loading="lazy" /> : <span className={styles.portrait} />}
      <span className={styles.qui}>
        <span className={styles.nomCarte}>{compte.nom}</span>
        <span className={styles.detail}>{compte.email ?? 'sans e-mail'}</span>
        <span className={styles.statut}>{compte.client ? `Client · ${fragments}` : `Compte appli, pas client · ${fragments}`}</span>
      </span>
    </button>
  )
}
