/**
 * QUOI     — les cultures du Hub (liste et fiches viennent de la même lecture).
 */
import { useQuery } from '@tanstack/react-query'
import { lireCulturesDuHub } from './api'

export function useCulturesDuHub() {
  return useQuery({ queryKey: ['hub-cultures-du-hub'], queryFn: lireCulturesDuHub })
}
