/**
 * QUOI     — la liste des contributions pour des critères donnés (gardée pendant qu'on change de page), les
 *            étiquettes, et les écritures d'une contribution.
 * POURQUOI — chaque écriture réussie rafraîchit la liste et la pastille « Photos et avis » de l'ouverture.
 *            Les écritures d'une photo passent toutes par une seule mutation : une écriture à la fois.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ajouterEtiquette, creerEtiquette, lireContributions, lireEtiquettes, modererContribution, modifierMessage,
  retirerEtiquette, supprimerContribution, type Contribution, type Criteres, type StatutContribution,
} from '../api/contributions'
import { chercherProduits } from '../api/shopify'

export function useContributions(criteres: Criteres) {
  return useQuery({ queryKey: ['hub-contributions', criteres], queryFn: () => lireContributions(criteres), placeholderData: keepPreviousData })
}

export function useEtiquettesDePhoto() {
  return useQuery({ queryKey: ['hub-etiquettes-photo'], queryFn: lireEtiquettes })
}

export function useProduitsShopify(terme: string) {
  return useQuery({ queryKey: ['hub-produits-shopify', terme], queryFn: () => chercherProduits(terme), enabled: terme.trim().length >= 2 })
}

const A_RAFRAICHIR = ['hub-contributions', 'hub-ouverture']

// Pas d'attente : la contribution décidée peut quitter la liste au rafraîchissement, et l'écran
// doit avoir choisi la suivante avant que sa lecture disparaisse.
function useRafraichir() {
  const client = useQueryClient()
  return () => {
    for (const k of A_RAFRAICHIR) void client.invalidateQueries({ queryKey: [k] })
  }
}

/**
 * Une écriture sur une photo (canal, produit, suppression) : l'action est donnée au moment du clic.
 * Ici on attend la relecture : tant que la photo affichée est périmée, un second clic referait la même
 * écriture (une deuxième image poussée sur Shopify, la première orpheline).
 */
export function useEcritureDePhoto() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (action: () => Promise<void>) => action(),
    onSuccess: () => Promise.all(A_RAFRAICHIR.map((k) => client.invalidateQueries({ queryKey: [k] }))),
  })
}

/** Les écritures d'une contribution, chacune avec sa propre erreur. */
export function useEcritureContribution() {
  const client = useQueryClient()
  const apres = useRafraichir()
  return {
    supprimer: useMutation({ mutationFn: (c: Contribution) => supprimerContribution(c), onSuccess: apres }),
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
      onSuccess: () => {
        apres()
        void client.invalidateQueries({ queryKey: ['hub-etiquettes-photo'] })
      },
    }),
  }
}
