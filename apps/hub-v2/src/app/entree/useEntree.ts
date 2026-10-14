/**
 * QUOI     — lit l'entrée (session + droit) et la relit à chaque connexion ou déconnexion.
 * POURQUOI — traduit la réponse en EtatEntree pour decideEntree. Jamais périmée d'elle-même
 *            (staleTime infini) : seuls un changement de session ou « Réessayer » la relisent.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '@/shared/supabase/client'
import type { EtatEntree } from './decideEntree'
import { lireEntree } from './entree'

export const CLE_ENTREE = ['hub-entree']

export function useEntree(): { etat: EtatEntree; relire: () => void } {
  const client = useQueryClient()
  const requete = useQuery({ queryKey: CLE_ENTREE, queryFn: lireEntree, retry: false, staleTime: Infinity })

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(() => {
      void client.invalidateQueries({ queryKey: CLE_ENTREE })
    })
    return () => {
      data.subscription.unsubscribe()
    }
  }, [client])

  const relire = () => void requete.refetch()
  // Une entrée déjà lue reste valable si une relecture échoue : seule la première lecture peut mettre en erreur.
  if (requete.data) return { etat: { statut: 'pret', ...requete.data }, relire }
  if (requete.isError) return { etat: { statut: 'erreur' }, relire }
  return { etat: { statut: 'lecture' }, relire }
}
