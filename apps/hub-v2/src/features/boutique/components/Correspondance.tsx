/**
 * QUOI     — « La correspondance Shopify » : quelle étiquette de produit débloque quel Fragment. Un
 *            formulaire en ligne pour en ajouter une, une ligne par correspondance, « Retirer » avec
 *            confirmation en ligne.
 * POURQUOI — quand un client achète un produit qui porte l'étiquette, le Fragment est à lui (webhook).
 *            L'étiquette est normalisée par l'api ; une erreur (doublon, refus) s'affiche telle quelle.
 */
import { useState } from 'react'
import { Balise } from '@/shared/ui/Balise'
import { Bloc } from '@/shared/ui/Bloc'
import { EnTeteDePage } from '@/shared/ui/EnTeteDePage'
import type { Correspondance as UneCorrespondance } from '../api/correspondance'
import type { Fragment } from '../api/fragments'
import { useAchats } from '../hooks/useAchats'
import { useAjouterCorrespondance, useCorrespondances, useRetirerCorrespondance } from '../hooks/useCorrespondance'
import { useFragments } from '../hooks/useFragments'
import styles from './Boutique.module.css'
import { OngletsFragments } from './OngletsFragments'

type Illustre = Pick<Fragment, 'id' | 'name' | 'illustration_url' | 'image_url'>

function LigneDeCorrespondance({ correspondance, fragment, onRetirer }: {
  correspondance: UneCorrespondance; fragment: Illustre | undefined; onRetirer: (id: number) => void
}) {
  const [confirme, setConfirme] = useState(false)
  const image = fragment?.illustration_url ?? fragment?.image_url
  return (
    <div className={styles.correspondance}>
      <Balise texte={correspondance.shopify_tag} teinte="boutique" />
      <span className={styles.debloque}>débloque</span>
      {image ? <img className={styles.vignette} src={image} alt="" /> : <span className={styles.vignette} />}
      <span className={styles.nom}><strong>{fragment?.name ?? `Fragment n° ${String(correspondance.unlock_ref_id)}`}</strong></span>
      {confirme ? (
        <span className={styles.confirmation}>
          Retirer cette correspondance ?
          <button type="button" className={styles.boutonContour} onClick={() => { onRetirer(correspondance.id) }}>Confirmer</button>
          <button type="button" className={styles.boutonContour} onClick={() => { setConfirme(false) }}>Annuler</button>
        </span>
      ) : (
        <button type="button" className={styles.boutonContour} onClick={() => { setConfirme(true) }}>Retirer</button>
      )}
    </div>
  )
}

export function Correspondance() {
  const { data: correspondances, isError } = useCorrespondances()
  const { data: fragments } = useFragments()
  const { data: achats } = useAchats()
  const ajouter = useAjouterCorrespondance()
  const retirer = useRetirerCorrespondance()
  const [tag, setTag] = useState('')
  const [fragmentId, setFragmentId] = useState('')

  const nombreAAssocier = achats?.filter((a) => a.statut === 'no_match').length
  const erreur = ajouter.error ?? retirer.error

  // Une écriture à la fois : l'erreur de la précédente ne reste pas affichée.
  function ajouterLaCorrespondance() {
    ajouter.reset()
    retirer.reset()
    ajouter.mutate({ tag, fragmentId: Number(fragmentId) }, { onSuccess: () => { setTag(''); setFragmentId('') } })
  }

  function retirerLaCorrespondance(id: number) {
    ajouter.reset()
    retirer.reset()
    retirer.mutate(id)
  }

  return (
    <div className={styles.ecran}>
      <EnTeteDePage
        surtitre="Fragments et boutique"
        titre="La correspondance Shopify"
        phrase="Une étiquette de produit Shopify débloque un Fragment : quand un client achète un produit qui la porte, le Fragment est à lui."
      />
      <OngletsFragments achats={nombreAAssocier} />
      <form className={styles.enLigne} onSubmit={(e) => { e.preventDefault(); ajouterLaCorrespondance() }}>
        <label className={styles.champ}>
          Étiquette Shopify
          <input value={tag} placeholder="fragment:hoplite" onChange={(e) => { setTag(e.target.value) }} />
        </label>
        <label className={styles.champ}>
          Fragment
          <select value={fragmentId} onChange={(e) => { setFragmentId(e.target.value) }}>
            <option value="">Choisir…</option>
            {fragments?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        <button type="submit" className={styles.boutonContour} disabled={!tag.trim() || !fragmentId || ajouter.isPending}>+ Ajouter</button>
      </form>
      {correspondances?.length === 0 && <p className={styles.calme}>Aucune correspondance.</p>}
      {correspondances && correspondances.length > 0 && (
        <Bloc>
          {correspondances.map((c) => (
            <LigneDeCorrespondance
              key={c.id}
              correspondance={c}
              fragment={fragments?.find((f) => f.id === c.unlock_ref_id)}
              onRetirer={retirerLaCorrespondance}
            />
          ))}
        </Bloc>
      )}
      {isError && <p className={styles.erreur} role="alert">La base ne répond pas.</p>}
      {erreur && <p className={styles.erreur} role="alert">{erreur.message}</p>}
    </div>
  )
}
