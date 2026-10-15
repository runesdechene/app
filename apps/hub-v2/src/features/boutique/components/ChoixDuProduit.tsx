/**
 * QUOI     — la recherche d'un produit Shopify pour relier une photo : un champ, une ligne par produit
 *            (vignette, titre, prix), « Annuler ».
 * POURQUOI — le champ attend 300 ms de calme avant de chercher (la brique le fait) : une requête
 *            Shopify par lettre serait refusée.
 */
import { useState } from 'react'
import { ChampDeRecherche } from '@/shared/ui/ChampDeRecherche'
import type { ProduitShopify } from '../api/shopify'
import { useProduitsShopify } from '../hooks/useContributions'
import styles from './Photos.module.css'

export function ChoixDuProduit({ onChoix, onAnnule }: { onChoix: (produit: ProduitShopify) => void; onAnnule: () => void }) {
  const [terme, setTerme] = useState('')
  const produits = useProduitsShopify(terme)

  return (
    <div className={styles.choixDuProduit}>
      <ChampDeRecherche valeur={terme} onChange={setTerme} etiquette="Rechercher un produit…" />
      {produits.isError && <p role="alert" className={styles.erreur}>{produits.error.message}</p>}
      {produits.data?.map((p) => (
        <button key={p.id} type="button" className={styles.produitTrouve} onClick={() => { onChoix(p) }}>
          {p.image ? <img src={p.image} alt="" /> : <span />}
          <span>{p.titre}</span>
          <span className={styles.calme}>{p.prix}</span>
        </button>
      ))}
      <button type="button" className={styles.lien} onClick={onAnnule}>Annuler</button>
    </div>
  )
}
