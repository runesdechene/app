/**
 * QUOI     — les Fragments posés sur la carte, à leur origine, quand le calque est montré.
 * POURQUOI — CarteScreen dit seulement s'il faut les montrer (le filtre, actif par défaut) ; ici, les
 *            marques suivent la liste. Elle ne bouge qu'aux drops : gardée en cache une heure.
 * ATTENTION — `onToucher` doit être stable (un setState ou un useCallback) : le suivi le garde.
 */
import { useQuery } from '@tanstack/react-query'
import type { Map as Carte } from 'maplibre-gl'
import { useEffect, useRef } from 'react'
import { maplibregl } from '@/shared/lib/maplibre'
import { fetchFragmentsSurLaCarte } from '../api/fragments'
import { suivreFragments } from '../lib/marquesFragments'

export function useFragmentsSurLaCarte(carte: Carte | null, montres: boolean, onToucher: (id: number) => void) {
  const { data } = useQuery({
    queryKey: ['carte', 'fragments'],
    queryFn: fetchFragmentsSurLaCarte,
    staleTime: 60 * 60 * 1000,
    enabled: carte !== null,
  })
  const suivi = useRef<ReturnType<typeof suivreFragments> | null>(null)

  useEffect(() => {
    if (!carte) return
    const s = suivreFragments((element, ou) => new maplibregl.Marker({ element }).setLngLat(ou).addTo(carte), onToucher)
    suivi.current = s
    return () => {
      s.vider()
      suivi.current = null
    }
  }, [carte, onToucher])

  useEffect(() => {
    suivi.current?.fragments(montres ? (data ?? []) : [])
  }, [carte, onToucher, data, montres])
}
