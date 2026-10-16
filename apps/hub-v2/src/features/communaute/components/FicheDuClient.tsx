/**
 * QUOI     — la fiche du client choisi au stand (maquette 631:1524) : qui il est, s'il est client en
 *            ligne, ses chiffres chez la boutique, son compte de l'appli, et ses Fragments à toucher.
 * POURQUOI — l'équipe vérifie le client avant de lui activer quoi que ce soit. Les chiffres viennent
 *            de Shopify (useClientShopify) : s'ils manquent, la fiche le dit, le reste fonctionne.
 */
import { useState } from 'react'
import { dateCourte, dateLongue, moisLong } from '@/shared/lib/dates'
import { depuis } from '@/shared/lib/quand'
import type { ClientShopify } from '../api/clientShopify'
import { useClientShopify } from '../hooks/useClientShopify'
import { useCompte } from '../hooks/useCompte'
import { useEcritureFragmentsDuCompte, useFragmentsAssociables } from '../hooks/useFragmentsDuCompte'
import { GrilleDeFragments } from './GrilleDeFragments'
import styles from './AssocierUnFragment.module.css'

const MOTS = { oui: 'Activé', non: 'Activer' }

export function FicheDuClient({ id, maintenant }: { id: string; maintenant: Date }) {
  const { data: compte, isError } = useCompte(id)
  const shopify = useClientShopify(compte?.email ?? null)
  const { data: tous = [] } = useFragmentsAssociables()
  const { associer, retirer } = useEcritureFragmentsDuCompte(id)
  const [aConfirmer, setAConfirmer] = useState<number | null>(null)

  if (isError) return <p className={styles.calme}>La base ne répond pas.</p>
  if (!compte) return <p className={styles.calme}>Chargement de la fiche…</p>

  const possedes = new Set(compte.fragments.map((f) => f.id))
  const erreur = associer.error ?? retirer.error

  function toucher(fragment: number) {
    associer.reset(); retirer.reset()
    if (!possedes.has(fragment)) { setAConfirmer(null); associer.mutate(fragment); return }
    if (aConfirmer === fragment) { setAConfirmer(null); retirer.mutate(fragment); return }
    setAConfirmer(fragment)
  }

  return (
    <section className={styles.fiche} aria-label={`Fiche de ${compte.nom}`}>
      <div className={styles.tete}>
        {compte.avatar ? <img className={styles.grandPortrait} src={compte.avatar} alt="" /> : <span className={styles.grandPortrait} />}
        <div className={styles.qui}>
          <h2 className={styles.nomClient}>{compte.nom}</h2>
          <span className={styles.detail}>{compte.email ?? 'sans e-mail'}</span>
          <span className={styles.balises}>
            {shopify.data?.derniereEnLigne && <span className={styles.balise} data-teinte="client">Cliente en ligne</span>}
            {shopify.data && !shopify.data.derniereEnLigne && shopify.data.commandesLues && <span className={styles.balise}>Pas cliente en ligne</span>}
            {compte.client && <span className={styles.balise} data-teinte="client">Client Runes de Chêne</span>}
            <span className={styles.balise}>Compte appli</span>
          </span>
        </div>
      </div>

      <ChiffresDuClient shopify={shopify.data} chargement={shopify.isPending} echec={shopify.isError}
        inscrit={compte.inscrit} visite={compte.derniere_visite} maintenant={maintenant} />

      <div className={styles.titreFragments}>
        <h3>Ses Fragments · {possedes.size} sur {tous.length}</h3>
        <span className={styles.detail}>Touche un Fragment pour l’activer ou le retirer</span>
      </div>
      <GrilleDeFragments fragments={tous} choisis={possedes} aConfirmer={aConfirmer} mots={MOTS}
        enCours={associer.isPending || retirer.isPending} onToucher={toucher} />
      {erreur && <p role="alert" className={styles.alerte}>{erreur.message}</p>}
    </section>
  )
}

function ChiffresDuClient({ shopify, chargement, echec, inscrit, visite, maintenant }: {
  shopify: ClientShopify | null | undefined; chargement: boolean; echec: boolean
  inscrit: string; visite: string | null; maintenant: Date
}) {
  const argent = shopify ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: shopify.devise, maximumFractionDigits: 0 }) : null
  return (
    <>
      <div className={styles.chiffres}>
        {shopify && argent && (
          <>
            <Chiffre libelle="Commandes" valeur={String(shopify.commandes)}
              sous={shopify.auStand === null ? '' : `dont ${String(shopify.auStand)} au stand`} />
            <Chiffre libelle="Dépensé" valeur={argent.format(shopify.depense)}
              sous={shopify.commandes > 0 ? `panier moyen ${argent.format(shopify.depense / shopify.commandes)}` : ''} />
            <Chiffre libelle="Client depuis" valeur={moisLong(shopify.depuis)} sous="chez la boutique" />
          </>
        )}
        <Chiffre libelle="Compte appli" valeur={dateCourte(inscrit)} sous={visite ? `dernière visite ${depuis(visite, maintenant)}` : 'jamais revenu'} />
      </div>
      <p className={styles.ligne}>
        {chargement && 'La boutique cherche ce client…'}
        {echec && 'La boutique ne répond pas : ses commandes ne s’affichent pas.'}
        {shopify === null && 'Inconnu de la boutique : aucune commande avec cette adresse.'}
        {shopify?.derniereEnLigne && `Dernière commande en ligne le ${dateLongue(shopify.derniereEnLigne.date)} : ${shopify.derniereEnLigne.produits.join(', ')} (${shopify.derniereEnLigne.numero}).`}
        {shopify && !shopify.derniereEnLigne && (shopify.commandesLues
          ? 'Aucune commande en ligne.'
          : 'Ses commandes anciennes ne sont pas lisibles (portée read_all_orders de Shopify).')}
      </p>
    </>
  )
}

function Chiffre({ libelle, valeur, sous }: { libelle: string; valeur: string; sous: string }) {
  return (
    <div className={styles.chiffre}>
      <span className={styles.libelle}>{libelle}</span>
      <span className={styles.valeur}>{valeur}</span>
      <span className={styles.detail}>{sous}</span>
    </div>
  )
}
