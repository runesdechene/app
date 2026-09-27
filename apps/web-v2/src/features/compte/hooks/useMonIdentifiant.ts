/**
 * QUOI     — l'identifiant de l'Explorateur connecté (null tant qu'on ne le connaît pas).
 * POURQUOI — le menu, l'avatar de la coquille et « Modifier mon profil » en ont besoin ; le
 *            cache de TanStack Query le lit une fois pour tous.
 */
import { useQuery } from '@tanstack/react-query'
import { monIdentifiant } from '../api/session'

export function useMonIdentifiant(): string | null {
  const { data } = useQuery({ queryKey: ['moi'], queryFn: monIdentifiant, staleTime: Infinity })
  return data ?? null
}
