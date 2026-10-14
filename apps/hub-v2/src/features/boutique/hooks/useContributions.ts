/**
 * QUOI     — la liste des contributions pour des critères donnés (gardée pendant qu'on change de page), les
 *            étiquettes, et les écritures d'une contribution.
 * POURQUOI — chaque écriture réussie rafraîchit la liste et la pastille « Photos et avis » de l'ouverture.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ajouterEtiquette, creerEtiquette, lireContributions, lireEtiquettes, modererContribution, modifierMessage,
  retirerEtiquette, type Criteres, type StatutContribution,
} from '../api/contributions'

export function useContributions(criteres: Criteres) {
  return useQuery({ queryKey: ['hub-contributions', criteres], queryFn: () => lireContributions(criteres), placeholderData: keepPreviousData })
}

export function useEtiquettesDePhoto() {
  return useQuery({ queryKey: ['hub-etiquettes-photo'], queryFn: lireEtiquettes })
}

/** Les écritures d'une contribution, chacune avec sa propre erreur. */
export function useEcritureContribution() {
  const client = useQueryClient()
  const apres = async () => {
    await Promise.all(['hub-contributions', 'hub-ouverture'].map((k) => client.invalidateQueries({ queryKey: [k] })))
  }
  return {
    moderer: useMutation({
      mutationFn: ({ id, statut, couronnes }: { id: string; statut: StatutContribution; couronnes?: number }) => (couronnes === undefined ? modererContribution(id, statut) : modererContribution(id, statut, couronnes)),
      onSuccess: apres,
    }),
    message: useMutation({
      mutationFn: ({ id, message }: { id: string; message: string | null }) => modifierMessage(id, message),
      onSuccess: apres,
    }),
    ajouter: useMutation({
      mutationFn: ({ id, etiquette }: { id: string; etiquette: string }) => ajouterEtiquette(id, etiquette),
      onSuccess: apres,
    }),
    retirer: useMutation({
      mutationFn: ({ id, etiquette }: { id: string; etiquette: string }) => retirerEtiquette(id, etiquette),
      onSuccess: apres,
    }),
    creer: useMutation({
      mutationFn: async ({ id, nom }: { id: string; nom: string }) => {
        await ajouterEtiquette(id, await creerEtiquette(nom))
      },
      onSuccess: async () => {
        await Promise.all([apres(), client.invalidateQueries({ queryKey: ['hub-etiquettes-photo'] })])
      },
    }),
  }
}
