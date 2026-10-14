/**
 * QUOI     — la fiche de modération d'un lieu : ses photos, son récit et son nom (modifiables), ses
 *            natures (1 à 3, la première est la principale), et la décision — vérifier, masquer.
 * POURQUOI — les écritures passent toutes par les mod_* de la base ; chaque refus s'affiche sous son bloc,
 *            sans rien perdre de ce qui a été tapé.
 */
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { dateCourte } from '@/shared/lib/dates'
import { ficheDansLAppli } from '@/shared/lib/liens'
import { Bloc } from '@/shared/ui/Bloc'
import { Tiroir } from '@/shared/ui/Tiroir'
import { TitreDeSection } from '@/shared/ui/TitreDeSection'
import type { FicheDeLieu } from '../api/lieux'
import { useLieu, useModeration, useNatures } from '../hooks/useLieu'
import communaute from './Communaute.module.css'
import styles from './Lieux.module.css'

const LISTE = '/communaute/lieux'

function Texte({ fiche }: { fiche: FicheDeLieu }) {
  const { texte } = useModeration(fiche.id)
  const [titre, setTitre] = useState(fiche.title)
  const [recit, setRecit] = useState(fiche.text ?? '')
  const [sensible, setSensible] = useState(fiche.sensible)
  return (
    <Bloc className={styles.formulaire ?? ''}>
      <label className={styles.champ}>
        Nom
        <input type="text" value={titre} onChange={(e) => { setTitre(e.target.value); texte.reset() }} />
      </label>
      <label className={styles.champ}>
        Récit
        <textarea rows={6} value={recit} onChange={(e) => { setRecit(e.target.value); texte.reset() }} />
      </label>
      <label className={styles.case}>
        <input type="checkbox" checked={sensible} onChange={(e) => { setSensible(e.target.checked); texte.reset() }} />
        Lieu sensible
      </label>
      <div className={styles.actions}>
        <button type="button" className={communaute.boutonContour} disabled={texte.isPending || titre.trim() === ''}
          onClick={() => { texte.mutate({ titre, texte: recit, sensible }) }}>Enregistrer le texte</button>
        {titre.trim() === '' && <p role="alert">Le nom ne peut pas être vide.</p>}
        {texte.isError && <p role="alert">{texte.error.message}</p>}
        {texte.isSuccess && <p role="status">Enregistré.</p>}
      </div>
    </Bloc>
  )
}

function Natures({ fiche }: { fiche: FicheDeLieu }) {
  const { natures } = useModeration(fiche.id)
  const toutes = useNatures()
  const [choisies, setChoisies] = useState(fiche.tags.map((t) => t.id))

  function cocher(id: string, oui: boolean) {
    natures.reset()
    setChoisies((avant) => (oui ? [...avant, id] : avant.filter((n) => n !== id)))
  }

  return (
    <Bloc className={styles.formulaire ?? ''}>
      {toutes.isError && <p role="alert">Les natures n’ont pas pu être lues.</p>}
      {toutes.data?.map((n) => (
        <label key={n.id} className={styles.case}>
          <input type="checkbox" checked={choisies.includes(n.id)} onChange={(e) => { cocher(n.id, e.target.checked) }} />
          {choisies[0] === n.id && '★ '}{n.title}
        </label>
      ))}
      <div className={styles.actions}>
        <button type="button" className={communaute.boutonContour} disabled={natures.isPending || choisies.length < 1 || choisies.length > 3}
          onClick={() => { natures.mutate(choisies) }}>Enregistrer les natures</button>
        {natures.isError && <p role="alert">{natures.error.message}</p>}
        {natures.isSuccess && <p role="status">Enregistré.</p>}
      </div>
    </Bloc>
  )
}

function Decision({ fiche }: { fiche: FicheDeLieu }) {
  const { verifier, masquer } = useModeration(fiche.id)
  const verifie = fiche.verified_at !== null
  return (
    <Bloc className={styles.formulaire ?? ''}>
      <div className={styles.actions}>
        <button type="button" className={communaute.boutonContour} disabled={verifier.isPending}
          onClick={() => { verifier.mutate(!verifie) }}>{verifie ? 'Retirer la vérification' : 'Vérifier le lieu'}</button>
        <button type="button" className={communaute.boutonContour} disabled={masquer.isPending}
          onClick={() => { masquer.mutate(!fiche.masked) }}>{fiche.masked ? 'Démasquer' : 'Masquer le lieu'}</button>
        <a href={ficheDansLAppli(fiche.id)} target="_blank" rel="noreferrer">Voir dans l’appli</a>
      </div>
      {verifier.isError && <p role="alert">{verifier.error.message}</p>}
      {masquer.isError && <p role="alert">{masquer.error.message}</p>}
    </Bloc>
  )
}

export function TiroirLieu() {
  const { id = '' } = useParams()
  const { data, isPending, isError, refetch } = useLieu(id)

  if (isPending) {
    return (
      <Tiroir titre="Lieu" retour={LISTE}>
        <p className={communaute.calme}>Lecture…</p>
      </Tiroir>
    )
  }
  if (isError) {
    return (
      <Tiroir titre="Lieu" retour={LISTE}>
        <p>La fiche n’a pas pu être lue.</p>
        <button type="button" className={communaute.boutonContour} onClick={() => void refetch()}>Réessayer</button>
        <Link to={LISTE}>Retour à la liste</Link>
      </Tiroir>
    )
  }
  if (data === null) {
    return (
      <Tiroir titre="Lieu introuvable" retour={LISTE}>
        <p>Lieu introuvable.</p>
        <Link to={LISTE}>Retour à la liste</Link>
      </Tiroir>
    )
  }

  return (
    <Tiroir titre={data.title} retour={LISTE}>
      <h1 className={communaute.nomFiche}>{data.title}</h1>
      {data.images.length > 0 && (
        <div className={styles.photos}>
          {data.images.map((image) => (
            <a key={image.url} href={image.url} target="_blank" rel="noreferrer">
              <img src={image.thumb ?? image.url} alt="" loading="lazy" />
            </a>
          ))}
        </div>
      )}
      <p className={communaute.calme}>
        Ajouté par {data.author_name ?? 'Un Voyageur'} ({data.author_places_count} lieux) · {dateCourte(data.created_at)} · {data.visit_count} visites · {data.discovered_count} découvertes
      </p>

      <TitreDeSection titre="Le lieu" />
      <Texte key={data.id} fiche={data} />

      <TitreDeSection titre="Ses natures" />
      <Natures key={data.id} fiche={data} />

      <TitreDeSection titre="Décision" />
      <Decision fiche={data} />
    </Tiroir>
  )
}
