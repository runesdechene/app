/**
 * QUOI     — « Les énigmes signalées » : la file à deux volets. À gauche les signalements en attente,
 *            à droite celui qu'on lit, avec ses décisions : accepter sa réponse, ou clore sans suite.
 * POURQUOI — le signalement choisi est dans l'adresse (?s=7, le premier par défaut). Une fois traité, on
 *            passe au suivant, sinon à celui d'avant. Le message « points rendus » vit ici, pas dans
 *            la lecture : celle-ci disparaît avec le signalement traité.
 */
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { dateCourte } from '@/shared/lib/dates'
import { depuis } from '@/shared/lib/quand'
import { pluriel, texteEnClair } from '@/shared/lib/texte'
import { Balise } from '@/shared/ui/Balise'
import { Bloc } from '@/shared/ui/Bloc'
import { EnTeteDePage } from '@/shared/ui/EnTeteDePage'
import type { SignalementEnigme } from '../api/signalementsEnigme'
import { useSignalementsEnigme, useTraitementEnigme } from '../hooks/useSignalementsEnigme'
import styles from './EnigmesSignalees.module.css'
import jeu from './Jeu.module.css'

const RAISONS: Record<string, string> = {
  reponse_refusee: 'Sa réponse aurait dû être acceptée',
  erreur: 'L’énoncé, la réponse ou l’explication est faux',
  autre: 'Autre chose',
}
const raison = (code: string) => RAISONS[code] ?? code

const pointsRendus = (n: number) => `${String(n)} ${pluriel(n, 'point')} ${pluriel(n, 'rendu')}`

function Lecture({ signalement, onTraite }: { signalement: SignalementEnigme; onTraite: (message: string) => void }) {
  const { enigme, reponseDonnee } = signalement
  const traitement = useTraitementEnigme()
  const peutAccepter = enigme.format === 'free' && reponseDonnee !== null

  function decider(accepter: boolean) {
    traitement.mutate({ id: signalement.id, accepter }, {
      onSuccess: (resultat) => { onTraite(accepter ? `Réponse acceptée, ${pointsRendus(resultat.rendus)}.` : '') },
    })
  }

  return (
    <Bloc className={styles.lecture ?? ''}>
      <p className={styles.enonce}>{texteEnClair(enigme.question)}</p>
      <p>Réponse attendue : {enigme.reponse}</p>
      {enigme.variantes.length > 0 && <p className={jeu.calme}>Variantes : {enigme.variantes.join(', ')}</p>}
      <p>{reponseDonnee === null ? 'N’a pas encore répondu' : `Sa réponse : ${reponseDonnee}`}</p>
      {signalement.reponseProposee && <p>Sa proposition : {signalement.reponseProposee}</p>}
      <div><Balise texte={raison(signalement.raison)} teinte="moderation" /></div>
      {signalement.precision && <p className={styles.precision}>« {signalement.precision} »</p>}
      <p className={jeu.calme}>Signalé par {signalement.qui.nom} le {dateCourte(signalement.quand)}</p>
      <div className={styles.decisions}>
        {peutAccepter && (
          <button type="button" className={styles.accepter} disabled={traitement.isPending}
            onClick={() => { decider(true) }}>Accepter sa réponse</button>
        )}
        <button type="button" className={jeu.boutonContour} disabled={traitement.isPending}
          onClick={() => { decider(false) }}>Clore sans suite</button>
        <Link to={`/jeu/enigmes/${String(enigme.numero)}`}>Modifier l’énigme</Link>
      </div>
      {traitement.error && <p role="alert">{traitement.error.message}</p>}
    </Bloc>
  )
}

export function EnigmesSignalees() {
  const [params, setParams] = useSearchParams()
  const { data, error } = useSignalementsEnigme()
  const [message, setMessage] = useState('')
  const maintenant = new Date()
  const choisi = data?.find((s) => String(s.id) === params.get('s')) ?? data?.[0]

  function choisir(id: number | undefined) {
    const suivants = new URLSearchParams(params)
    if (id === undefined) suivants.delete('s')
    else suivants.set('s', String(id))
    setParams(suivants, { replace: true })
  }

  function apresTraitement(texte: string) {
    setMessage(texte)
    if (!data || !choisi) return
    const rang = data.indexOf(choisi)
    choisir((data[rang + 1] ?? data[rang - 1])?.id)
  }

  return (
    <div className={jeu.ecran}>
      <EnTeteDePage surtitre="Le jeu" titre="Les énigmes signalées"
        phrase={data && data.length > 0 ? `${String(data.length)} signalement${data.length > 1 ? 's attendent' : ' attend'} une décision.` : ''} />
      {error && <p className={jeu.calme}>{error.message || 'La base ne répond pas.'}</p>}
      {message && <p role="status" className={jeu.calme}>{message}</p>}
      {data?.length === 0 && <Bloc><p className={jeu.calme}>Aucun signalement en attente.</p></Bloc>}
      {data && choisi && (
        <div className={styles.volets}>
          <Bloc>
            {data.map((s) => (
              <button key={s.id} type="button" className={styles.ligne} aria-current={s.id === choisi.id}
                onClick={() => { choisir(s.id); setMessage('') }}>
                <span className={styles.question}>{texteEnClair(s.enigme.question)}</span>
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
