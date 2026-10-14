/**
 * QUOI     — « Les achats à associer » : les commandes Shopify sans Fragment trouvé (à décider à la main)
 *            et les achats qui attendent l'inscription de leur client (montrés, sans geste).
 * POURQUOI — seules les lignes no_match se traitent : « Associer un Fragment » (le Fragment va au compte)
 *            ou « Rien à débloquer ». Les pending se règlent seuls à l'inscription. La base refuse ce
 *            qui n'a pas lieu d'être : son message s'affiche tel quel.
 */
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { dateCourte } from '@/shared/lib/dates'
import { pluriel } from '@/shared/lib/texte'
import { Balise } from '@/shared/ui/Balise'
import { Bloc } from '@/shared/ui/Bloc'
import { ChoixSegmente } from '@/shared/ui/ChoixSegmente'
import { EnTeteDePage } from '@/shared/ui/EnTeteDePage'
import type { Achat } from '../api/achats'
import { useAchats, useAssocierAchat, useClasserAchat } from '../hooks/useAchats'
import { useFragments } from '../hooks/useFragments'
import { STATUTS_ACHAT, tagsDuJournal } from '../lib/achats'
import styles from './Boutique.module.css'
import { OngletsFragments } from './OngletsFragments'

const STATUTS = [
  { valeur: 'no_match', libelle: 'Sans Fragment' },
  { valeur: 'pending', libelle: 'En attente d’inscription' },
] as const

function LigneDAchat({ achat }: { achat: Achat }) {
  const { data: fragments } = useFragments()
  const associer = useAssocierAchat()
  const classer = useClasserAchat()
  const [fragmentId, setFragmentId] = useState('')
  const etiquettes = tagsDuJournal(achat.tag)
  const erreur = associer.error ?? classer.error

  // Une décision à la fois : l'erreur de la précédente ne reste pas affichée.
  function associerLAchat() {
    associer.reset()
    classer.reset()
    associer.mutate({ id: achat.id, fragment: Number(fragmentId) })
  }

  function classerLAchat() {
    associer.reset()
    classer.reset()
    classer.mutate(achat.id)
  }

  return (
    <div className={styles.achat}>
      <div className={styles.achatEntete}>
        <strong>Commande n° {achat.commande ?? '—'} · {dateCourte(achat.quand)}</strong>
        <span>{achat.email}</span>
        {achat.compte ? <Link to={`/communaute/comptes/${achat.compte.id}`}>{achat.compte.nom}</Link> : <span>aucun compte</span>}
        <Balise texte={STATUTS_ACHAT[achat.statut]} teinte={achat.statut === 'no_match' ? 'moderation' : 'sommeil'} />
      </div>
      {etiquettes.length > 0 && (
        <div className={styles.etiquettes}>{etiquettes.map((t) => <Balise key={t} texte={t} teinte="boutique" />)}</div>
      )}
      {achat.statut === 'no_match' && (
        <div className={styles.enLigne}>
          {achat.compte && (
            <>
              <select className={styles.champ} aria-label="Fragment à associer" value={fragmentId} onChange={(e) => { setFragmentId(e.target.value) }}>
                <option value="">Choisir un Fragment…</option>
                {fragments?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <button
                type="button" className={styles.boutonContour}
                disabled={!fragmentId || associer.isPending}
                onClick={associerLAchat}
              >
                Associer un Fragment
              </button>
            </>
          )}
          <button type="button" className={styles.boutonContour} disabled={classer.isPending} onClick={classerLAchat}>
            Rien à débloquer
          </button>
        </div>
      )}
      {erreur && <p className={styles.erreur} role="alert">{erreur.message}</p>}
    </div>
  )
}

export function Achats() {
  const [params, setParams] = useSearchParams()
  const statut = STATUTS.find((s) => s.valeur === params.get('statut'))?.valeur ?? 'no_match'
  const { data: achats, isError } = useAchats()

  const sansFragment = achats?.filter((a) => a.statut === 'no_match').length
  const enAttente = achats?.filter((a) => a.statut === 'pending').length
  const phrase = achats && sansFragment !== undefined && enAttente !== undefined
    ? `${String(sansFragment)} ${pluriel(sansFragment, 'commande')} sans Fragment trouvé ${pluriel(sansFragment, 'attend', 'attendent')} une décision ; ${String(enAttente)} ${pluriel(enAttente, 'achat')} ${pluriel(enAttente, 'attend', 'attendent')} l’inscription de leur client.`
    : ''
  const lignes = achats?.filter((a) => a.statut === statut)

  return (
    <div className={styles.ecran}>
      <EnTeteDePage surtitre="Fragments et boutique" titre="Les achats à associer" phrase={phrase} />
      <OngletsFragments achats={sansFragment} />
      <ChoixSegmente
        nom="Statut" options={[...STATUTS]} choisi={statut}
        onChoix={(v) => { setParams((p) => { p.set('statut', v); return p }, { replace: true }) }}
      />
      {isError && <p className={styles.erreur} role="alert">La base ne répond pas.</p>}
      {lignes?.length === 0 && <p className={styles.calme}>Aucun achat n’attend.</p>}
      {lignes && lignes.length > 0 && <Bloc>{lignes.map((a) => <LigneDAchat key={a.id} achat={a} />)}</Bloc>}
    </div>
  )
}
