/**
 * QUOI     — les natures et les époques que la feuille des filtres propose.
 * POURQUOI — elles ne bougent presque jamais : lues une fois, gardées en cache. On ne les demande
 *            qu'à l'ouverture de la feuille (`actif`).
 */
import { useQuery } from '@tanstack/react-query'
import { fetchFiltres } from '../api/carte'
import type { FiltresDeCarte } from '../api/lireCarte'

const AUCUN: FiltresDeCarte = { natures: [], epoques: [] }

export function useFiltresDeCarte(actif: boolean): FiltresDeCarte {
  return (
    useQuery({
      queryKey: ['carte', 'filtres'],
      queryFn: fetchFiltres,
      staleTime: Infinity,
      enabled: actif,
    }).data ?? AUCUN
  )
}
