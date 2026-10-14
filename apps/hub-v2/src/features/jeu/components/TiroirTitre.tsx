/**
 * QUOI     — l'éditeur d'un titre (tiroir) : nom, nom au féminin, description, icône ; pour un titre de chemin
 *            seulement, le chemin et le seuil, et la suppression (confirmée en ligne).
 * POURQUOI — la condition d'une connaissance ou du polymathe est tenue par le jeu : elle s'affiche en lecture et
 *            n'est jamais envoyée. Un nouveau titre est toujours un titre de chemin.
 */
import { useState, type SyntheticEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Tiroir } from '@/shared/ui/Tiroir'
import type { Titre } from '../api/titres'
import { useEcritureTitre, useTitres } from '../hooks/useTitres'
import { CHEMINS, conditionModifiable, libelleDeCondition, lireCondition } from '../lib/titre'
import styles from './Jeu.module.css'

const LISTE = '/jeu/titres'
const videEnNull = (texte: string) => texte.trim() || null

function Formulaire({ fiche, titres }: { fiche: Titre | null; titres: Titre[] }) {
  const { search } = useLocation()
  const naviguer = useNavigate()
  const { creer, modifier, supprimer } = useEcritureTitre()
  const ecriture = fiche ? modifier : creer
  const condition = lireCondition(fiche?.condition ?? null)
  const [nom, setNom] = useState(fiche?.name ?? '')
  const [nomF, setNomF] = useState(fiche?.name_f ?? '')
  const [description, setDescription] = useState(fiche?.description ?? '')
  const [icone, setIcone] = useState(fiche?.icon ?? '')
  const [stat, setStat] = useState(condition.stat ?? 'level')
  const [seuil, setSeuil] = useState(String(condition.min ?? 0))
  const [confirmer, setConfirmer] = useState(false)
  const [refus, setRefus] = useState<string | null>(null)
  const sur = fiche === null || conditionModifiable(fiche)
  const retour = LISTE + search

  // Tout champ modifié efface « Enregistré. » et les messages.
  function modifie() {
    modifier.reset()
    creer.reset()
    setRefus(null)
  }

  function enregistrer(e: SyntheticEvent) {
    e.preventDefault()
    const min = Number(seuil)
    const erreur = !nom.trim() ? 'Un titre a un nom.'
      : sur && (seuil.trim() === '' || !Number.isInteger(min) || min < 0) ? 'Le seuil est un nombre entier, zéro ou plus.'
        : null
    setRefus(erreur)
    if (erreur) return
    const texte = { name: nom.trim(), name_f: videEnNull(nomF), description: videEnNull(description), icon: videEnNull(icone) }
    if (fiche) {
      modifier.mutate({ id: fiche.id, titre: sur ? { ...texte, condition: { stat, min } } : texte })
    } else {
      const ordre = Math.max(0, ...titres.map((t) => t.order)) + 1
      creer.mutate({ titre: { ...texte, condition: { stat, min } }, ordre }, {
        onSuccess: (id) => { void naviguer({ pathname: `${LISTE}/${String(id)}`, search }) },
      })
    }
  }

  return (
    <form className={styles.formulaire} onSubmit={enregistrer} onChange={modifie}>
      <label className={styles.champ}>Nom
        <input value={nom} onChange={(e) => { setNom(e.target.value) }} />
      </label>
      <label className={styles.champ}>Nom au féminin
        <input value={nomF} onChange={(e) => { setNomF(e.target.value) }} />
      </label>
      <label className={styles.champ}>Description
        <textarea rows={3} value={description} onChange={(e) => { setDescription(e.target.value) }} />
      </label>
      <label className={styles.champ}>Icône (emoji)
        <input value={icone} onChange={(e) => { setIcone(e.target.value) }} />
      </label>

      {sur ? (
        <>
          <label className={styles.champ}>Chemin
            <select value={stat} onChange={(e) => { setStat(e.target.value) }}>
              {Object.entries(CHEMINS).map(([valeur, libelle]) => <option key={valeur} value={valeur}>{libelle}</option>)}
            </select>
          </label>
          <label className={styles.champ}>Seuil
            <input type="number" value={seuil} onChange={(e) => { setSeuil(e.target.value) }} />
          </label>
        </>
      ) : (
        <p className={styles.calme}>{libelleDeCondition(fiche.condition)}</p>
      )}

      <div>
        <button type="submit" className={styles.boutonContour} disabled={ecriture.isPending}>Enregistrer</button>
        {modifier.isSuccess && <span role="status"> Enregistré.</span>}
        {refus && <p role="alert">{refus}</p>}
        {ecriture.isError && <p role="alert">{ecriture.error.message}</p>}
      </div>

      {fiche && sur && (
        <div>
          {confirmer ? (
            <span>
              Supprimer ce titre ?{' '}
              <button type="button" className={styles.boutonContour} disabled={supprimer.isPending}
                onClick={() => { setConfirmer(false); supprimer.mutate(fiche.id, { onSuccess: () => { void naviguer(retour) } }) }}>Confirmer</button>{' '}
              <button type="button" className={styles.boutonContour} onClick={() => { setConfirmer(false) }}>Annuler</button>
            </span>
          ) : (
            <button type="button" className={styles.boutonContour} onClick={() => { setConfirmer(true) }}>Supprimer</button>
          )}
          {supprimer.isError && <p role="alert">{supprimer.error.message}</p>}
        </div>
      )}
    </form>
  )
}

export function TiroirTitre() {
  const { id } = useParams()
  const retour = LISTE + useLocation().search
  const { data, isPending, isError, refetch } = useTitres()

  if (isPending) {
    return <Tiroir titre="Titre" retour={retour}><p className={styles.calme}>Lecture…</p></Tiroir>
  }
  if (isError) {
    return (
      <Tiroir titre="Titre" retour={retour}>
        <p>La fiche n’a pas pu être lue.</p>
        <button type="button" className={styles.boutonContour} onClick={() => void refetch()}>Réessayer</button>
        <Link to={retour}>Retour à la liste</Link>
      </Tiroir>
    )
  }
  if (id === undefined) return <Tiroir titre="Nouveau titre" retour={retour}><Formulaire fiche={null} titres={data.titres} /></Tiroir>
  // Une adresse qui n'est pas un numéro ne désigne aucun titre.
  const fiche = /^[1-9]\d*$/.test(id) ? data.titres.find((t) => t.id === Number(id)) : undefined
  if (!fiche) {
    return (
      <Tiroir titre="Titre introuvable" retour={retour}>
        <p>Titre introuvable.</p>
        <Link to={retour}>Retour à la liste</Link>
      </Tiroir>
    )
  }
  // La clé remet le formulaire à zéro quand on passe d'un titre à l'autre.
  return <Tiroir titre={fiche.name} retour={retour}><Formulaire key={fiche.id} fiche={fiche} titres={data.titres} /></Tiroir>
}
