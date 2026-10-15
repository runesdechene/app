/**
 * QUOI     — la synchro Shopify côté serveur : la liaison comptes-clients (shopify-sync), la lecture des
 *            comptes reliés (hub_comptes_clients) et la pose d'un lot d'étiquettes (shopify-batch-tags).
 * POURQUOI — les fonctions Netlify tiennent le jeton Shopify ; ici on ne fait que les appeler et lire
 *            leur réponse (une erreur de fonction remonte en message lisible).
 */
import { appelerFonction, lireReponse } from '@/shared/lib/fonctions'
import { supabase } from '@/shared/supabase/client'
import type { CompteClient, Etiquetage, ReponseEtiquetage } from '../lib/provenance'
import { SHOP } from './shopify'

export type ResultatLiaison = {
  success: boolean; shopifyTotal: number; supabaseTotal: number
  updated: number; created: number; skipped: number
  toCreateCount: number; toUpdateCount: number; logs: string[]
}

export async function relierComptesEtClients(): Promise<ResultatLiaison> {
  const reponse = await appelerFonction('shopify-sync', { methode: 'POST', corps: { shop: SHOP } })
  return lireReponse<ResultatLiaison>(reponse)
}

export async function lireComptesClients(): Promise<CompteClient[]> {
  const { data, error } = await supabase.rpc('hub_comptes_clients')
  if (error) throw new Error(error.message)
  return data as CompteClient[]
}

export async function envoyerEtiquettes(lot: Etiquetage[]): Promise<ReponseEtiquetage[]> {
  const reponse = await appelerFonction('shopify-batch-tags', { methode: 'POST', corps: { items: lot } })
  const { results } = await lireReponse<{ results?: ReponseEtiquetage[] }>(reponse)
  return results ?? []
}
