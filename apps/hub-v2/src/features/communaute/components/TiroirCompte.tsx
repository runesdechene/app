/**
 * QUOI     — la fiche d'un compte (maquette 595:1140) : identité, parcours, rôle, compteurs,
 *            Fragments, achats, dernières traces.
 * POURQUOI — le rôle se change ici : c'est le seul geste d'écriture de la fiche. Le choix ne part qu'au
 *            bouton « Changer » (une flèche du clavier dans la liste n'écrit rien), et faire un admin se confirme.
 */
import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { dateCourte } from '@/shared/lib/dates'
import { depuis, heureDuFil } from '@/shared/lib/quand'
import { pluriel } from '@/shared/lib/texte'
import { Balise } from '@/shared/ui/Balise'
import { Bloc } from '@/shared/ui/Bloc'
import { Tiroir } from '@/shared/ui/Tiroir'
import { TitreDeSection } from '@/shared/ui/TitreDeSection'
import { Tuile } from '@/shared/ui/Tuile'
import type { FicheDeCompte } from '../api/comptes'
import { useChangerRole, useCompte } from '../hooks/useCompte'
import { balisesDuCompte } from '../lib/balises'
import { PROVENANCES } from '../lib/provenances'
import { AssocierFragment } from './AssocierFragment'
import styles from './Communaute.module.css'

const LISTE = '/communaute/comptes'
const ROLES = { user: 'Explorateur', ambassador: 'Ambassadeur', moderator: 'Modérateur', admin: 'Admin' }
const TRACES: Record<FicheDeCompte['traces'][number]['type'], string> = {
  visite: 'a posé sa marque à',
  decouverte: 'a découvert',
  ajout: 'a ajouté',
  enigme: 'a percé',
  enigme_manquee: 'a manqué',
}

// « Énigme n° 295 » se lit « a percé l’énigme n° 295 » : l'article colle au nom, en minuscule.
function phrase(t: FicheDeCompte['traces'][number]): string {
  const enigme = t.type === 'enigme' || t.type === 'enigme_manquee'
  return enigme ? `${TRACES[t.type]} l’${t.texte.charAt(0).toLowerCase()}${t.texte.slice(1)}` : `${TRACES[t.type]} ${t.texte}`
}

function ChoixDuRole({ fiche }: { fiche: FicheDeCompte }) {
  const changer = useChangerRole(fiche.id)
  const [roleChoisi, setRoleChoisi] = useState(fiche.role)
  const [confirmer, setConfirmer] = useState(false)

  if (confirmer) {
    return (
      <span>
        Faire de {fiche.nom} un admin ?{' '}
        <button type="button" className={styles.boutonContour} disabled={changer.isPending}
          onClick={() => { setConfirmer(false); changer.mutate(roleChoisi) }}>Confirmer</button>{' '}
        <button type="button" className={styles.boutonContour} onClick={() => { setConfirmer(false) }}>Annuler</button>
      </span>
    )
  }

  return (
    <span>
      <select aria-label="Rôle" value={roleChoisi} disabled={changer.isPending}
        onChange={(e) => { setRoleChoisi(e.target.value); changer.reset() }}>
        {Object.entries(ROLES).map(([valeur, libelle]) => <option key={valeur} value={valeur}>{libelle}</option>)}
      </select>{' '}
      <button type="button" className={styles.boutonContour} disabled={roleChoisi === fiche.role || changer.isPending}
        onClick={() => { if (roleChoisi === 'admin') setConfirmer(true); else changer.mutate(roleChoisi) }}>Changer</button>
      {changer.isError && <span role="alert"> {changer.error.message}</span>}
    </span>
  )
}

export function TiroirCompte() {
  const { id = '' } = useParams()
  const { data, isPending, isError, refetch } = useCompte(id)
  // La fiche est une route enfant : l'adresse garde les critères de la liste, on y revient avec.
  const retour = LISTE + useLocation().search

  if (isPending) {
    return (
      <Tiroir titre="Compte" retour={retour}>
        <p className={styles.calme}>Lecture…</p>
      </Tiroir>
    )
  }
  if (isError) {
    return (
      <Tiroir titre="Compte" retour={retour}>
        <p>La fiche n’a pas pu être lue.</p>
        <button type="button" className={styles.boutonContour} onClick={() => void refetch()}>Réessayer</button>
        <Link to={retour}>Retour à la liste</Link>
      </Tiroir>
    )
  }
  if (data === null) {
    return (
      <Tiroir titre="Compte introuvable" retour={retour}>
        <p>Compte introuvable.</p>
        <Link to={retour}>Retour à la liste</Link>
      </Tiroir>
    )
  }

  const maintenant = new Date()
  const balises = balisesDuCompte({ ...data, fragments: data.fragments.length }, maintenant)
  const departement = data.departement ? `${data.departement}${data.code ? ` (${data.code})` : ''}` : '—'
  const boutique = data.client ? `Client validé · ${String(data.achats.length)} ${pluriel(data.achats.length, 'commande')}` : '—'

  return (
    <Tiroir titre={data.nom} retour={retour}>
      <div className={styles.identite}>
        {data.avatar ? <img className={styles.grandPortrait} src={data.avatar} alt="" /> : <span className={styles.grandPortrait} />}
        <div>
          <h1 className={styles.nomFiche}>{data.nom}</h1>
          <div className={styles.nomEtBalises}>{balises.map((b) => <Balise key={b.texte} {...b} />)}</div>
          <p className={styles.detail}>
            Inscrit le {dateCourte(data.inscrit)} · vu {data.derniere_visite ? depuis(data.derniere_visite, maintenant) : 'jamais'}
          </p>
        </div>
      </div>

      <TitreDeSection titre="Son parcours" />
      <Bloc className={styles.parcours ?? ''}>
        <span>Arrivé par</span>
        <span>{data.provenance ? (PROVENANCES[data.provenance] ?? data.provenance) : '—'}</span>
        <span>Département</span>
        <span>{departement}</span>
        <span>Boutique</span>
        <span>{boutique}</span>
        <span>E-mail</span>
        <span>{data.email ?? '—'}</span>
        <span>Rôle</span>
        {/* La clé remet le choix à zéro quand la fiche change (autre compte, rôle enregistré). */}
        <ChoixDuRole key={`${data.id}:${data.role}`} fiche={data} />
      </Bloc>

      <TitreDeSection titre="Ce qu’il a fait" />
      <div className={styles.quatre}>
        <Tuile libelle="Découverts" valeur={String(data.compteurs.decouverts)} />
        <Tuile libelle="Visites" valeur={String(data.compteurs.visites)} />
        <Tuile libelle="Ajoutés" valeur={String(data.compteurs.ajoutes)} />
        <Tuile libelle="Énigmes" valeur={String(data.compteurs.enigmes)} />
      </div>

      <AssocierFragment compte={data.id} fragments={data.fragments} />

      <TitreDeSection titre="Ses achats" />
      <Bloc>
        {data.achats.length === 0 && <p className={styles.calme}>Aucun achat.</p>}
        {data.achats.map((a, i) => (
          <div key={a.commande ?? i} className={styles.ligneFiche}>
            <span>Commande n° {a.commande ?? '—'}</span>
            <span className={styles.detail}>{dateCourte(a.quand)}</span>
            {a.statut === 'unlocked' ? <Balise texte="Débloqué" teinte="visite" /> : <Balise texte={a.statut} teinte="boutique" />}
          </div>
        ))}
      </Bloc>

      <TitreDeSection titre="Ses dernières traces" />
      <Bloc>
        {data.traces.length === 0 && <p className={styles.calme}>Aucune trace.</p>}
        {data.traces.map((t) => (
          <p key={`${t.type}-${t.quand}`} className={styles.ligneFiche}>
            {heureDuFil(t.quand, maintenant)} · {phrase(t)}
          </p>
        ))}
      </Bloc>
    </Tiroir>
  )
}
