/**
 * QUOI     — le Codex, en cache : un scan ou un lien au Hub l'invalide (clé `['codex']`).
 */
import { useQuery } from '@tanstack/react-query'
import { fetchCodex } from '../api/codex'

export const CODEX = ['codex'] as const

export function useCodex() {
  const query = useQuery({ queryKey: CODEX, queryFn: fetchCodex })
  return { codex: query.data, erreur: query.isError, reessayer: query.refetch }
}
