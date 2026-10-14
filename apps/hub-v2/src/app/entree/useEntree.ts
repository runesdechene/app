/**
 * QUOI     — lit l'entrée (session + droit) et la relit à chaque connexion ou déconnexion.
 * POURQUOI — traduit la réponse en EtatEntree pour decideEntree.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '@/shared/supabase/client'
import type { EtatEntree } from './decideEntree'
import { lireEntree } from './entree'

export const CLE_ENTREE = ['hub-entree']

export function useEntree(): { etat: EtatEntree; relire: () => void } {
  const client = useQueryClient()
  const requete = useQuery({ queryKey: CLE_ENTREE, queryFn: lireEntree, retry: false })

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(() => {
      void client.invalidateQueries({ queryKey: CLE_ENTREE })
    })
    return () => {
      data.subscription.unsubscribe()
    }
  }, [client])

  const relire = () => void requete.refetch()
  if (requete.isPending) return { etat: { statut: 'lecture' }, relire }
  if (requete.isError) return { etat: { statut: 'erreur' }, relire }
  return { etat: { statut: 'pret', ...requete.data }, relire }
}
