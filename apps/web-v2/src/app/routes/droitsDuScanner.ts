/**
 * QUOI     — ce que le scanner permet d'apprendre : rien, ajouter des vues (tout Porteur), ou aussi
 *            les retirer (admin). Le scanner, lui, est ouvert à tous.
 * POURQUOI — Uriel, 05/11 : les membres doivent enregistrer un maximum de vues. La règle vit en base
 *            (`peut_apprendre_vue`, mig 585), qui refuse aussi l'ajout à qui n'y a pas droit.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchMoi } from '@/features/lieu/api/lieu'
import { peutApprendreVue, type Apprendre } from '@/features/scan/api/scan'

export async function lireApprendre(): Promise<Apprendre> {
  const moi = await fetchMoi() // sans session, elle lève : « non »
  if (moi.admin) return 'admin'
  return (await peutApprendreVue()) ? 'porteur' : 'non'
}

/** Lu une fois, sans nouvel essai ; « non » tant que la réponse n'est pas là. */
export function useApprendre(): Apprendre {
  const droits = useQuery({
    queryKey: ['scanner', 'apprendre'],
    queryFn: lireApprendre,
    staleTime: Infinity,
    retry: false,
  })
  return droits.data ?? 'non'
}
