/**
 * QUOI     — le passeport d'un Explorateur, depuis le cache ou la base.
 * POURQUOI — `undefined` pendant le chargement, `null` si l'Explorateur est introuvable : les
 *            écrans distinguent les deux, comme pour le profil.
 * ATTENTION — la clé commence par `['explorateur', id]` : une visite, une découverte ou une
 *            suppression invalident ce préfixe (useVisite, useDecouvrir, useSupprimer) ; le
 *            passeport se recharge alors avec le reste, au lieu de rester périmé.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchPasseport } from '../api/passeport'
import type { Passeport } from '../api/lirePasseport'

export function passeportKey(id: string) {
  return ['explorateur', id, 'passeport']
}

export function usePasseport(id: string): {
  passeport: Passeport | null | undefined
  erreur: boolean
  reessayer: () => void
} {
  const query = useQuery({ queryKey: passeportKey(id), queryFn: () => fetchPasseport(id) })
  return {
    passeport: query.data,
    erreur: query.isError,
    reessayer: () => {
      void query.refetch()
    },
  }
}
