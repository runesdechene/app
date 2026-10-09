/**
 * QUOI     — les Actifs et soi, posés sur la carte : les portraits (marques MapLibre) et les zones
 *            des pistes brouillées. De très loin, les portraits restent et les noms se taisent
 *            (`data-loin` sur la carte — Uriel, 01/10).
 * POURQUOI — CarteScreen dit seulement quoi montrer ; ici, comment le tenir à jour à chaque
 *            relecture et à chaque déplacement de soi.
 * ATTENTION — `onToucher` doit être stable (un setState) : le suivi le garde du premier rendu.
 */
import { maplibregl } from '@/shared/lib/maplibre'
import type { GeoJSONSource, Map as Carte } from 'maplibre-gl'
import { useEffect, useRef } from 'react'
import type { Point } from '@/shared/lib/distance'
import type { Actif } from '../api/lireActifs'
import { ZONES, zonesEnGeoJSON } from '../lib/actifs'
import { suivreActifs, type Soi } from '../lib/marquesActifs'

const ZOOM_LOIN = 6

export function useActifsSurLaCarte(
  carte: Carte | null,
  actifs: Actif[],
  maPosition: Point | null,
  soi: Soi | null,
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
    void carte?.getSource<GeoJSONSource>(ZONES)?.setData(zonesEnGeoJSON(actifs))
  }, [carte, actifs])

  // `soi` est refait à chaque rendu : on suit ses champs, pas l'objet.
  const nom = soi?.nom
  const avatar = soi?.avatar ?? null
  const titre = soi?.titre ?? null
  useEffect(() => {
    suivi.current?.moi(maPosition, nom === undefined ? null : { nom, avatar, titre })
  }, [carte, maPosition, nom, avatar, titre])
}
