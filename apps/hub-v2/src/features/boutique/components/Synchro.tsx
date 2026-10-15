/**
 * QUOI     — « La synchro Shopify » : relier les comptes d'Explore aux clients de la boutique, puis poser sur
 *            chaque client relié l'étiquette de provenance (source:app ou source:shopify, app-player).
 * POURQUOI — deux actions longues qui touchent la boutique : jamais en même temps, une progression pendant,
 *            un compte rendu à la fin, les erreurs nommées client par client. Aucune étiquette de faction.
 */
import { pluriel } from '@/shared/lib/texte'
import { Bloc } from '@/shared/ui/Bloc'
import { EnTeteDePage } from '@/shared/ui/EnTeteDePage'
import { TitreDeSection } from '@/shared/ui/TitreDeSection'
import { useLiaison, usePoseDesEtiquettes, type FinDePose } from '../hooks/useSynchro'
import type { ResultatLiaison } from '../api/synchro'
import styles from './Boutique.module.css'

function finDeLiaison(r: ResultatLiaison): string {
  const comptes = pluriel(r.created, 'compte créé', 'comptes créés')
  return `${String(r.shopifyTotal)} ${pluriel(r.shopifyTotal, 'client')} ${pluriel(r.shopifyTotal, 'lu')} — ${String(r.updated)} ${pluriel(r.updated, 'relié')}, ${String(r.created)} ${comptes}, ${String(r.skipped)} déjà à jour.`
}

function nonCrees(r: ResultatLiaison): number {
  return Math.max(0, r.toCreateCount - r.created)
}

function nonLies(r: ResultatLiaison): number {
  return Math.max(0, r.toUpdateCount - r.updated)
}

// Les lignes de journal que la fonction marque d'un ❌ ou d'un ⚠️ sont des échecs ou des alertes.
const estUnEchec = (ligne: string) => ligne.startsWith('❌') || ligne.startsWith('⚠️')

function finDePose(f: FinDePose): string {
  const misAJour = f.fait - f.erreursCompte
  return `${String(f.fait)} ${pluriel(f.fait, 'client')} ${pluriel(f.fait, 'traité')} — ${String(misAJour)} mis à jour, ${String(f.erreursCompte)} ${pluriel(f.erreursCompte, 'erreur')}, ${String(f.ignores)} ${pluriel(f.ignores, 'ignoré')} (déjà étiquetés ou absents de Shopify).`
}

export function Synchro() {
  const liaison = useLiaison()
  const pose = usePoseDesEtiquettes()
  const occupe = liaison.isPending || pose.isPending

  function lancerLaLiaison() {
    liaison.reset()
    liaison.mutate()
  }

  function poserLesEtiquettes() {
    pose.reset()
    pose.mutate()
  }

  const erreurs = pose.data?.erreurs ?? pose.progres?.erreurs ?? []
  const progression = pose.progres ? `${String(pose.progres.fait)} / ${String(pose.progres.total)} clients…` : 'Lecture des clients…'

  return (
    <div className={styles.ecran}>
      <EnTeteDePage
        surtitre="Fragments et boutique"
        titre="La synchro Shopify"
        phrase="Relier les comptes d’Explore aux clients de la boutique, et dire à Shopify d’où vient chaque client."
      />

      <TitreDeSection titre="Relier les comptes aux clients" />
      <Bloc>
        <p>Chaque client Shopify est relié au compte qui a son e-mail ; un client sans compte en reçoit un (provenance « shopify »). Rien n’est créé en double.</p>
        <button type="button" className={styles.boutonContour} disabled={occupe} onClick={lancerLaLiaison}>
          {liaison.isPending ? 'Liaison en cours… (1 à 2 min)' : 'Lancer la liaison'}
        </button>
        {liaison.data && (
          <>
            <p role="status">{finDeLiaison(liaison.data)}</p>
            {nonCrees(liaison.data) > 0 && (
              <p role="alert">{`${String(nonCrees(liaison.data))} ${pluriel(nonCrees(liaison.data), 'compte n’a pas pu être créé', 'comptes n’ont pas pu être créés')} — voir les journaux.`}</p>
            )}
            {nonLies(liaison.data) > 0 && (
              <p role="alert">{`${String(nonLies(liaison.data))} ${pluriel(nonLies(liaison.data), 'compte n’a pas pu être relié', 'comptes n’ont pas pu être reliés')} — voir les journaux.`}</p>
            )}
            <ul>
              {liaison.data.logs.map((ligne, i) => (
                <li key={i} data-echec={String(estUnEchec(ligne))} className={estUnEchec(ligne) ? styles.erreur : undefined}>{ligne}</li>
              ))}
            </ul>
          </>
        )}
        {liaison.isError && <p role="alert">{liaison.error.message}</p>}
      </Bloc>

      <TitreDeSection titre="L’étiquette de provenance" />
      <Bloc>
        <p>Pose source:app ou source:shopify (et app-player pour les joueurs) sur chaque client relié qui n’a pas encore d’étiquette source:. Ses autres étiquettes ne bougent pas.</p>
        <button type="button" className={styles.boutonContour} disabled={occupe} onClick={poserLesEtiquettes}>
          {pose.isPending ? progression : 'Poser les étiquettes'}
        </button>
        {pose.data && <p role="status">{finDePose(pose.data)}</p>}
        {erreurs.length > 0 && <ul role={pose.data ? 'alert' : undefined}>{erreurs.map((e, i) => <li key={i}>{e}</li>)}</ul>}
        {pose.isError && <p role="alert">{pose.error.message}</p>}
      </Bloc>
    </div>
  )
}
