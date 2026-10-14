/**
 * QUOI     — les énigmes : la liste pour des critères (gardée pendant qu'on change de page), une fiche,
 *            les cultures, et l'écriture qui rafraîchit la fiche et la liste.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { enregistrerEnigme, lireCultures, lireEnigme, lireEnigmes, type Criteres } from '../api/enigmes'
import type { Brouillon } from '../lib/enigme'

export function useEnigmes(criteres: Criteres) {
  return useQuery({ queryKey: ['hub-enigmes', criteres], queryFn: () => lireEnigmes(criteres), placeholderData: keepPreviousData })
}

export function useEnigme(id: number) {
  return useQuery({ queryKey: ['hub-enigme', id], queryFn: () => lireEnigme(id) })
}

export function useCultures() {
  return useQuery({ queryKey: ['hub-cultures'], queryFn: lireCultures, staleTime: Infinity })
}

export function useEcritureEnigme(id: number | null) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (brouillon: Brouillon) => enregistrerEnigme(id, brouillon),
    onSuccess: () => {
      if (id !== null) void client.invalidateQueries({ queryKey: ['hub-enigme', id] })
      void client.invalidateQueries({ queryKey: ['hub-enigmes'] })
    },
  })
}
