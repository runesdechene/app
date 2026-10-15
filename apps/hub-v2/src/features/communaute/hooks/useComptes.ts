/**
 * QUOI     — la liste des comptes pour des critères donnés (gardée pendant qu'on change de page),
 *            et son export CSV (tous les comptes qui correspondent, pas seulement la page).
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { lireComptes, type Criteres } from '../api/comptes'
import { versCsv } from '../lib/csv'

export function useComptes(criteres: Criteres) {
  return useQuery({ queryKey: ['hub-comptes', criteres], queryFn: () => lireComptes(criteres), placeholderData: keepPreviousData })
}

export async function exporterComptes(criteres: Criteres): Promise<string> {
  const tout = await lireComptes({ ...criteres, limite: 10000, decalage: 0 })
  return versCsv(tout.lignes)
}
