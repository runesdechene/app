/**
 * QUOI     — les natures (liste et fiches viennent de la même lecture) et leur écriture, qui rafraîchit la liste.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { creerNature, lireNatures, modifierNature, type NatureAEcrire } from '../api/natures'

// La clé « jeu » est distincte de celle des Lieux (['hub-natures'], autre forme de données) ; l'écriture
// invalide le préfixe ['hub-natures'], donc les deux lectures se rafraîchissent.
export function useNatures() {
  return useQuery({ queryKey: ['hub-natures', 'jeu'], queryFn: lireNatures })
}

// Sans identifiant : on crée la nature (l'identifiant est donné à l'envoi) ; avec : on la modifie.
export function useEcritureNature() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, nature, creation }: { id: string; nature: NatureAEcrire; creation: boolean }) =>
      (creation ? creerNature(id, nature) : modifierNature(id, nature)),
    // On attend la liste à jour : une création ouvre sa fiche aussitôt.
    onSuccess: () => client.invalidateQueries({ queryKey: ['hub-natures'] }),
  })
}
