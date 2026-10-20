/**
 * QUOI     — « Les signalements » : la file à deux volets (maquette 596:1319). À gauche les
 *            signalements en attente, à droite celui qu'on lit, avec ses deux décisions.
 * POURQUOI — le signalement choisi est dans l'adresse (?s=41, le premier par défaut). Une fois
 *            traité, on passe au suivant, sinon à celui d'avant.
 */
import { Link, useSearchParams } from 'react-router'
import { dateCourte } from '@/shared/lib/dates'
import { ficheDansLAppli } from '@/shared/lib/liens'
import { depuis } from '@/shared/lib/quand'
import { Balise } from '@/shared/ui/Balise'
import { Bloc } from '@/shared/ui/Bloc'
import { EnTeteDePage } from '@/shared/ui/EnTeteDePage'
import type { Signalement } from '../api/signalements'
import { useLieu } from '../hooks/useLieu'
import { useSignalements, useTraitement } from '../hooks/useSignalements'
import { RAISONS } from '../lib/raisons'
import communaute from './Communaute.module.css'
import styles from './Signalements.module.css'

const raison = (code: string) => RAISONS[code] ?? code

function Lecture({ signalement, onTraite }: { signalement: Signalement; onTraite: () => void }) {
  const { lieu, qui } = signalement
  const fiche = useLieu(lieu.id)
  const { traiter, masquer } = useTraitement()
  const erreur = traiter.error ?? masquer.error
  return (
    <Bloc className={styles.lecture ?? ''}>
      <h2 className={communaute.nomFiche}>{lieu.nom}</h2>
      <div><Balise texte={raison(signalement.raison)} teinte="moderation" /></div>
      {signalement.precision && <p className={styles.precision}>« {signalement.precision} »</p>}
      {fiche.isError && (
        <p role="alert">Photos indisponibles. <button type="button" className={communaute.boutonContour} onClick={() => void fiche.refetch()}>Réessayer</button></p>
      )}
      {fiche.data && fiche.data.photos.length > 0 && (
        <div className={styles.photos}>
          {fiche.data.photos.map(({ url, vignette }, rang) => (
            <a key={`${String(rang)}-${url}`} href={url} target="_blank" rel="noreferrer">
              <img src={vignette} alt="" loading="lazy" />
            </a>
          ))}
        </div>
      )}
      <p className={communaute.calme}>Signalé par {qui.nom} le {dateCourte(signalement.quand)}</p>
      <div className={styles.liens}>
        <a href={ficheDansLAppli(lieu.id)} target="_blank" rel="noreferrer">Voir dans l’appli</a>
        <Link to={`/communaute/lieux/${lieu.id}`}>Ouvrir la fiche de modération</Link>
      </div>
      <div className={styles.decisions}>
        {!lieu.masque && (
          <button type="button" className={communaute.boutonContour} disabled={masquer.isPending}
            onClick={() => { masquer.mutate(lieu.id) }}>Masquer le lieu</button>
        )}
        <button type="button" className={styles.traite} disabled={traiter.isPending}
          onClick={() => { traiter.mutate(signalement.id, { onSuccess: onTraite }) }}>Traité</button>
      </div>
      {erreur && <p role="alert">{erreur.message}</p>}
    </Bloc>
  )
}

export function Signalements() {
  const [params, setParams] = useSearchParams()
  const { data, error } = useSignalements()
  const maintenant = new Date()
  const choisi = data?.find((s) => String(s.id) === params.get('s')) ?? data?.[0]

  function choisir(id: number | undefined) {
    const suivants = new URLSearchParams(params)
    if (id === undefined) suivants.delete('s')
    else suivants.set('s', String(id))
    setParams(suivants, { replace: true })
  }

  function apresTraitement() {
    if (!data || !choisi) return
    const rang = data.indexOf(choisi)
    choisir((data[rang + 1] ?? data[rang - 1])?.id)
  }

  return (
    <div className={communaute.ecran}>
      <EnTeteDePage surtitre="Communauté" titre="Les signalements"
        phrase={data && data.length > 0 ? `${String(data.length)} signalement${data.length > 1 ? 's attendent' : ' attend'} une décision.` : ''} />
      {error && <p className={communaute.calme}>{error.message || 'La base ne répond pas.'}</p>}
      {data?.length === 0 && <Bloc><p className={communaute.calme}>Aucun signalement en attente.</p></Bloc>}
      {data && choisi && (
        <div className={styles.volets}>
          <Bloc>
            {data.map((s) => (
              <button key={s.id} type="button" className={styles.ligne} aria-current={s.id === choisi.id}
                onClick={() => { choisir(s.id) }}>
                <span className={styles.nom}>{s.lieu.nom}</span>
                <span>{raison(s.raison)}</span>
                <span className={styles.detail}>par {s.qui.nom} · {depuis(s.quand, maintenant)}</span>
              </button>
            ))}
          </Bloc>
          <Lecture key={choisi.id} signalement={choisi} onTraite={apresTraitement} />
        </div>
      )}
    </div>
  )
}
