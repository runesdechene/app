/**
 * QUOI     — les Actifs et soi, posés sur la carte : les portraits (marques MapLibre) et les zones
 *            des pistes brouillées. Portraits et noms à tout zoom (Uriel, 01/10).
 * POURQUOI — CarteScreen dit seulement quoi montrer ; ici, comment le tenir à jour à chaque
 *            relecture et à chaque déplacement de soi.
 * ATTENTION — `onToucher` doit être stable (un setState) : le suivi le garde du premier rendu.
 */
import maplibregl, { type GeoJSONSource, type Map as Carte } from 'maplibre-gl'
import { useEffect, useRef } from 'react'
import type { Point } from '@/shared/lib/distance'
import type { Actif } from '../api/lireActifs'
import { ZONES, zonesEnGeoJSON } from '../lib/actifs'
import { suivreActifs } from '../lib/marquesActifs'

export function useActifsSurLaCarte(
  carte: Carte | null,
  actifs: Actif[],
  moi: { point: Point | null; avatar: string | null },
  onToucher: (id: string) => void,
) {
  const suivi = useRef<ReturnType<typeof suivreActifs> | null>(null)

  useEffect(() => {
    if (!carte) return
    const s = suivreActifs(
      (element, ou) => new maplibregl.Marker({ element }).setLngLat(ou).addTo(carte),
      onToucher,
    )
    suivi.current = s
    return () => {
      s.vider()
      suivi.current = null
    }
  }, [carte, onToucher])

  useEffect(() => {
    suivi.current?.actifs(actifs)
    carte?.getSource<GeoJSONSource>(ZONES)?.setData(zonesEnGeoJSON(actifs))
  }, [carte, actifs])

  useEffect(() => {
    suivi.current?.moi(moi.point, moi.avatar)
  }, [carte, moi.point, moi.avatar])
}
