/**
 * QUOI     — la fiche d'un lieu, les natures possibles, et les quatre décisions de l'équipe.
 * POURQUOI — chaque décision rafraîchit la fiche, la liste et la pastille « Lieux à modérer » du menu.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { changerNatures, lireLieu, lireNatures, masquerLieu, modifierLieu, verifierLieu, type Champs } from '../api/lieux'

export function useLieu(id: string) {
  return useQuery({ queryKey: ['hub-lieu', id], queryFn: () => lireLieu(id) })
}

export function useNatures() {
  return useQuery({ queryKey: ['hub-natures'], queryFn: lireNatures, staleTime: Infinity })
}

export function useModeration(id: string) {
  const client = useQueryClient()
  function rafraichir() {
    void client.invalidateQueries({ queryKey: ['hub-lieu', id] })
    void client.invalidateQueries({ queryKey: ['hub-lieux'] })
    void client.invalidateQueries({ queryKey: ['hub-ouverture'] })
  }
  return {
    texte: useMutation({ mutationFn: (c: Champs) => modifierLieu(id, c), onSuccess: rafraichir }),
    natures: useMutation({ mutationFn: (ids: string[]) => changerNatures(id, ids), onSuccess: rafraichir }),
    verifier: useMutation({ mutationFn: (oui: boolean) => verifierLieu(id, oui), onSuccess: rafraichir }),
    masquer: useMutation({ mutationFn: (oui: boolean) => masquerLieu(id, oui), onSuccess: rafraichir }),
  }
}
