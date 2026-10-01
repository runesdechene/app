/**
 * QUOI     — les Actifs et soi, posés sur la carte : les portraits (marques MapLibre), les zones des
 *            pistes brouillées, et de très loin des pastilles (`data-loin` sur la carte).
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

const ZOOM_LOIN = 6

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
    const loin = () => {
      carte.getContainer().toggleAttribute('data-loin', carte.getZoom() < ZOOM_LOIN)
    }
    loin()
    carte.on('zoom', loin)
    return () => {
      s.vider()
      carte.off('zoom', loin)
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
