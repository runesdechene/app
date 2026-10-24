/**
 * QUOI     — « Ses missives » sur la fiche d'un compte (maquette 771:3259) : s'il accepte les nouvelles, depuis quand
 *            et par où ; ses listes ; sa suite en cours ; ses réponses au questionnaire ; ses derniers envois.
 * POURQUOI — voir d'un coup d'œil ce qu'il reçoit et ce qu'il a dit de lui. Un seul geste : le nommer ambassadeur.
 */
import { QUESTIONS } from '@runes/missives'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dateCourte } from '@/shared/lib/dates'
import { Balise } from '@/shared/ui/Balise'
import { Bloc } from '@/shared/ui/Bloc'
import { Bouton } from '@/shared/ui/Bouton'
import { TitreDeSection } from '@/shared/ui/TitreDeSection'
import { lireSesMissives, nommerAmbassadeur, type SesMissives as Donnees } from '../api/sesMissives'
import styles from './Communaute.module.css'

const PORTES: Record<string, string> = {
  site: 'le site', stand: 'le stand', flyer: 'le flyer', appli: 'l’appli', shopify: 'la boutique', hub: 'le Hub',
  desabonnement: 'le lien de désabonnement', rebond: 'une adresse qui rebondit',
}
const LISTES: Record<string, string> = { prospects: 'Prospect', porteurs: 'Porteur', meilleurs: 'Meilleur client' }
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const EPOQUES = new Map<string, string>(QUESTIONS.epoques.reponses)

// « 03/11 » : le jour et le mois d'une date courte.
const jourEtMois = (iso: string) => dateCourte(iso).slice(0, 5)

function Nouvelles({ d }: { d: Donnees }) {
  const porte = d.porte ? PORTES[d.porte] : null
  if (d.accord) {
    return (
      <span className={styles.detail}>
        <Balise texte="Abonné" teinte="actif" /> {d.accord_le && `depuis le ${dateCourte(d.accord_le)}`}{porte && ` · arrivé par ${porte}`}
      </span>
    )
  }
  if (d.accord_le) {
    return <span className={styles.detail}><Balise texte="Désabonné" teinte="pause" /> le {dateCourte(d.accord_le)}{porte && ` · par ${porte}`}</span>
  }
  return <span className={styles.detail}>N’a pas choisi : reçoit seulement les e-mails clients</span>
}

function Suite({ suite }: { suite: NonNullable<Donnees['suite']> }) {
  const etat = suite.arretee_le
    ? `arrêtée le ${dateCourte(suite.arretee_le)} par un achat`
    : suite.prochaine_le
      ? `${suite.jour_fait === null ? 'pas encore commencée' : `jour ${String(suite.jour_fait)} parti`} · le prochain le ${jourEtMois(suite.prochaine_le)}`
      : 'finie'
  return <span className={styles.qui}><strong>{suite.nom}</strong><span className={styles.detail}>{etat}</span></span>
}

export function SesMissives({ compte }: { compte: string }) {
  const client = useQueryClient()
  const { data, error } = useQuery({ queryKey: ['ses-missives', compte], queryFn: () => lireSesMissives(compte) })
  const nommer = useMutation({
    mutationFn: () => nommerAmbassadeur(compte),
    onSuccess: () => client.invalidateQueries({ queryKey: ['ses-missives', compte] }),
  })

  if (error) return <p role="alert" className={styles.calme}>Ses missives n’ont pas pu se charger : {error.message}</p>
  if (!data) return null
  const p = data.portrait
  const envoi = data.derniers_envois[0]

  return (
    <>
      <TitreDeSection titre="Ses missives" />
      <Bloc className={styles.parcours ?? ''}>
        <span>Les nouvelles</span>
        <Nouvelles d={data} />

        <span>Ses listes</span>
        <span>
          {/* « ambassadeurs » est déjà dit par la balise de son rôle, juste après. */}
          {data.listes.filter((l) => l !== 'ambassadeurs').map((l) => <Balise key={l} texte={LISTES[l] ?? l} teinte="porteur" />)}
          {data.listes.length === 0 && !data.ambassadeur && '—'}
          {data.ambassadeur && <Balise texte={data.ambassadeur === 'egerie' ? 'Égérie' : 'Ambassadeur'} teinte="porteur" />}
        </span>

        <span>Sa suite</span>
        {data.suite ? <Suite suite={data.suite} /> : <span>—</span>}

        <span>Anniversaire</span>
        <span>{p?.anniv_jour && p.anniv_mois ? `${String(p.anniv_jour)} ${MOIS[p.anniv_mois - 1] ?? ''}` : '—'}</span>

        {p?.repondu_le ? (
          <>
            <span>Ses époques</span>
            <span>{p.epoques.length > 0 ? p.epoques.map((e) => EPOQUES.get(e) ?? e).join(', ') : '—'}</span>
            <span>Ce qu’il attend</span>
            <span className={styles.qui}>
              <strong>{p.attente ? `« ${p.attente} »` : '—'}</strong>
              <span className={styles.detail}>répondu le {dateCourte(p.repondu_le)}</span>
            </span>
          </>
        ) : (
          <>
            <span>Questionnaire</span>
            <span className={styles.detail}>N’a pas répondu au questionnaire.</span>
          </>
        )}

        <span>Derniers envois</span>
        {envoi ? (
          <span className={styles.qui}>
            <strong>« {envoi.objet} »</strong>
            <span className={styles.detail}>{dateCourte(envoi.le)}{data.derniers_envois.length > 1 && ` · et ${String(data.derniers_envois.length - 1)} avant`}</span>
          </span>
        ) : <span>—</span>}
      </Bloc>
      {!data.ambassadeur && (
        <Bouton sorte="discret" disabled={nommer.isPending} onClick={() => { nommer.mutate() }}>
          + Ajouter aux Ambassadeurs et égéries
        </Bouton>
      )}
      {nommer.error && <p role="alert" className={styles.calme}>{nommer.error.message}</p>}
    </>
  )
}
