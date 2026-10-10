/**
 * QUOI     — les natures et les époques que la feuille des filtres propose, et les bornes des époques.
 * POURQUOI — elles ne bougent presque jamais : lues une fois, gardées en cache. Les membres les
 *            demandent dès la carte (le sablier ne s'encre jamais devant une frise vide) ; le
 *            visiteur, jamais (`actif`).
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
