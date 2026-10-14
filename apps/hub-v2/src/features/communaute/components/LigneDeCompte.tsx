/**
 * QUOI     — une ligne de la liste des comptes (maquette 594:961) : portrait, nom et balises, une
 *            ligne de détail, arrivé par, département, Fragments, dernière visite, inscription.
 */
import { Link } from 'react-router'
import chevron from '@/assets/ui/chevron.svg'
import { depuis } from '@/shared/lib/quand'
import { moisAnnee } from '@/shared/lib/dates'
import { Balise } from '@/shared/ui/Balise'
import type { Compte } from '../api/comptes'
import { balisesDuCompte } from '../lib/balises'
import styles from './Communaute.module.css'

const PROVENANCES: Record<string, string> = { app: 'Appli', shopify: 'Boutique en ligne', stand: 'Stand', flyer: 'Flyer' }

export function LigneDeCompte({ compte, maintenant }: { compte: Compte; maintenant: Date }) {
  const detail = [compte.client ? 'client validé' : '', compte.email ?? ''].filter(Boolean).join(' · ')
  return (
    <Link className={styles.ligneCompte} to={`/communaute/comptes/${compte.id}`}>
      {compte.avatar ? <img className={styles.portrait} src={compte.avatar} alt="" loading="lazy" /> : <span className={styles.portrait} />}
      <span className={styles.qui}>
        <span className={styles.nomEtBalises}>
          <span className={styles.nom}>{compte.nom}</span>
          {balisesDuCompte(compte, maintenant).map((b) => <Balise key={b.texte} {...b} />)}
        </span>
        <span className={styles.detail}>{detail}</span>
      </span>
      <span className={styles.colonne}>{compte.provenance ? (PROVENANCES[compte.provenance] ?? compte.provenance) : '—'}</span>
      <span className={styles.colonne}>{compte.departement ? `${compte.departement}${compte.code ? ` (${compte.code})` : ''}` : '—'}</span>
      <span className={styles.nombre}>{compte.fragments}</span>
      <span className={styles.colonne}>{compte.derniere_visite ? depuis(compte.derniere_visite, maintenant) : 'jamais'}</span>
      <span className={styles.colonne}>{moisAnnee(compte.inscrit)}</span>
      <img className={styles.chevron} src={chevron} alt="" />
    </Link>
  )
}
