/**
 * QUOI     — le profil public d'un Explorateur, depuis le cache ou la base.
 * POURQUOI — `profil` vaut `undefined` pendant le chargement, `null` si l'Explorateur est
 *            introuvable : l'écran distingue les deux. Sans identifiant, on ne demande rien.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchExplorateur } from '../api/explorateur'
import type { ExplorateurProfile } from '../api/lireProfil'

export function explorateurKey(id: string) {
  return ['explorateur', id]
}

export function useExplorateur(id: string | null): {
  profil: ExplorateurProfile | null | undefined
  erreur: boolean
  reessayer: () => void
} {
  const query = useQuery({
    queryKey: explorateurKey(id ?? ''),
    queryFn: () => fetchExplorateur(id ?? ''),
    enabled: id !== null,
  })
  return {
    profil: query.data,
    erreur: query.isError,
    reessayer: () => {
      void query.refetch()
    },
  }
}
