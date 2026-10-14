/**
 * QUOI     — l'éditeur d'une énigme (tiroir) : culture, difficulté, récit, question, format, choix ou
 *            variantes, réponse, explication, active ; sous le formulaire, ce que les joueurs en ont fait.
 * POURQUOI — « Active » est un champ du formulaire, jamais une écriture immédiate. Les règles sont celles de la
 *            base (lib/enigme) : le message s'affiche avant l'envoi. Une création réussie ouvre sa fiche.
 */
import { useState, type SyntheticEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Tiroir } from '@/shared/ui/Tiroir'
import type { FicheEnigme } from '../api/enigmes'
import { useCultures, useEcritureEnigme, useEnigme } from '../hooks/useEnigmes'
import { DIFFICULTES, erreurDEnigme, type Brouillon, type Difficulte } from '../lib/enigme'
import styles from './Jeu.module.css'

const LISTE = '/jeu/enigmes'
const s = (n: number) => (n > 1 ? 's' : '')

function Formulaire({ fiche }: { fiche: FicheEnigme | null }) {
  const { search } = useLocation()
  const naviguer = useNavigate()
  const { data: cultures = [] } = useCultures()
  const ecriture = useEcritureEnigme(fiche?.id ?? null)
  const [culture, setCulture] = useState(fiche?.culture ?? '')
  const [difficulte, setDifficulte] = useState<Difficulte>(fiche?.difficulte ?? 'easy')
  const [recit, setRecit] = useState(fiche?.recit ?? '')
  const [question, setQuestion] = useState(fiche?.question ?? '')
  const [format, setFormat] = useState<Brouillon['format']>(fiche?.format ?? 'qcm')
  const [choix, setChoix] = useState(fiche?.choix && fiche.choix.length >= 2 ? fiche.choix : ['', ''])
  const [reponse, setReponse] = useState(fiche?.reponse ?? '')
  const [variantes, setVariantes] = useState(fiche?.variantes.join('\n') ?? '')
  const [explication, setExplication] = useState(fiche?.explication ?? '')
  const [active, setActive] = useState(fiche?.active ?? true)
  const [refus, setRefus] = useState<string | null>(null)

  // Tout champ modifié efface « Enregistré. » et les messages.
  function modifie() {
    ecriture.reset()
    setRefus(null)
  }

  function enregistrer(e: SyntheticEvent) {
    e.preventDefault()
    const brouillon: Brouillon = { culture: culture || null, difficulte, recit, question, format, choix, reponse, variantes, explication, active }
    const erreur = erreurDEnigme(brouillon)
    setRefus(erreur)
    if (erreur) return
    ecriture.mutate(brouillon, {
      onSuccess: (id) => { if (!fiche) void naviguer({ pathname: `${LISTE}/${String(id)}`, search }) },
    })
  }

  return (
    <form className={styles.formulaire} onSubmit={enregistrer} onChange={modifie}>
      <label className={styles.champ}>Culture
        <select value={culture} onChange={(e) => { setCulture(e.target.value) }}>
          <option value="">Universelle</option>
          {cultures.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </label>
      <label className={styles.champ}>Difficulté
        <select value={difficulte} onChange={(e) => { setDifficulte(e.target.value as Difficulte) }}>
          {Object.entries(DIFFICULTES).map(([valeur, libelle]) => <option key={valeur} value={valeur}>{libelle}</option>)}
        </select>
      </label>
      <label className={styles.champ}>Récit
        <textarea rows={4} value={recit} onChange={(e) => { setRecit(e.target.value) }} />
      </label>
      <label className={styles.champ}>Question
        <textarea rows={3} value={question} onChange={(e) => { setQuestion(e.target.value) }} />
      </label>
      <label className={styles.champ}>Format
        <select value={format} onChange={(e) => { setFormat(e.target.value as Brouillon['format']) }}>
          <option value="qcm">QCM</option>
          <option value="free">Libre</option>
        </select>
      </label>

      {format === 'qcm' && (
        <fieldset className={styles.choix}>
          <legend>Choix</legend>
          {choix.map((c, i) => (
            <span key={i} className={styles.unChoix}>
              <input aria-label={`Choix ${String(i + 1)}`} value={c}
                onChange={(e) => { setChoix(choix.map((v, j) => (j === i ? e.target.value : v))) }} />
              {choix.length > 2 && (
                <button type="button" className={styles.boutonContour} aria-label={`Retirer le choix ${String(i + 1)}`}
                  onClick={() => { setChoix(choix.filter((_, j) => j !== i)); modifie() }}>Retirer</button>
              )}
            </span>
          ))}
          <button type="button" className={styles.boutonContour} onClick={() => { setChoix([...choix, '']); modifie() }}>+ Ajouter un choix</button>
        </fieldset>
      )}

      <label className={styles.champ}>Réponse
        <input value={reponse} onChange={(e) => { setReponse(e.target.value) }} />
      </label>
      {format === 'free' && (
        <label className={styles.champ}>Variantes (une par ligne)
          <textarea rows={3} value={variantes} onChange={(e) => { setVariantes(e.target.value) }} />
        </label>
      )}
      <label className={styles.champ}>Explication
        <textarea rows={3} value={explication} onChange={(e) => { setExplication(e.target.value) }} />
      </label>
      <label className={styles.case}>
        <input type="checkbox" checked={active} onChange={(e) => { setActive(e.target.checked) }} /> Active
      </label>

      <div>
        <button type="submit" className={styles.boutonContour} disabled={ecriture.isPending}>Enregistrer</button>
        {ecriture.isSuccess && fiche && <span role="status"> Enregistré.</span>}
        {refus && <p role="alert">{refus}</p>}
        {ecriture.isError && <p role="alert">{ecriture.error.message}</p>}
      </div>

      {fiche && (
        <p className={styles.calme}>
          {`${String(fiche.reponses)} réponse${s(fiche.reponses)} · ${String(fiche.percees)} percée${s(fiche.percees)} · ${String(fiche.signalements)} signalement${s(fiche.signalements)}`}
        </p>
      )}
    </form>
  )
}

function FicheExistante({ id }: { id: number }) {
  const { data, isPending, isError, refetch } = useEnigme(id)
  const retour = LISTE + useLocation().search

  if (isPending) {
    return <Tiroir titre="Énigme" retour={retour}><p className={styles.calme}>Lecture…</p></Tiroir>
  }
  if (isError) {
    return (
      <Tiroir titre="Énigme" retour={retour}>
        <p>La fiche n’a pas pu être lue.</p>
        <button type="button" className={styles.boutonContour} onClick={() => void refetch()}>Réessayer</button>
        <Link to={retour}>Retour à la liste</Link>
      </Tiroir>
    )
  }
  if (data === null) {
    return (
      <Tiroir titre="Énigme introuvable" retour={retour}>
        <p>Énigme introuvable.</p>
        <Link to={retour}>Retour à la liste</Link>
      </Tiroir>
    )
  }
  // La clé remet le formulaire à zéro quand on passe d'une énigme à l'autre.
  return <Tiroir titre={`Énigme n° ${String(id)}`} retour={retour}><Formulaire key={id} fiche={data} /></Tiroir>
}

export function TiroirEnigme() {
  const { id } = useParams()
  const retour = LISTE + useLocation().search
  if (id === undefined) return <Tiroir titre="Nouvelle énigme" retour={retour}><Formulaire fiche={null} /></Tiroir>
  return <FicheExistante id={Number(id)} />
}
