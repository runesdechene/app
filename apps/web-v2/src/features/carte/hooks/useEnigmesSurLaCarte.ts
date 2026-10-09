/**
 * QUOI     — les énigmes qui m'attendent, versées dans leur calque ; un sceau touché rend son id et
 *            l'endroit exact du sceau (pour y poser celui qui se retourne), et l'énigme `cachee` quitte
 *            la carte pendant ce temps.
 * POURQUOI — CarteScreen pose la couche dans son `style.load` (`poserEnigmes`) ; ce hook la nourrit.
 * ATTENTION — un style rechargé repart d'une source vide : les énigmes y reviennent (même motif que
 *            `useMesPinsSurLaCarte`). `carte` à null (visiteur) : rien n'est demandé.
 */
import { useQuery } from '@tanstack/react-query'
import type { GeoJSONSource, Map as Carte, MapLayerMouseEvent } from 'maplibre-gl'
import { useEffect, useRef } from 'react'
import { fetchEnigmesEnAttente } from '../api/enigmes'
import type { EnigmeEnAttente } from '../api/lireEnigmes'
import { CALQUE_SCEAUX_ENIGMES, CALQUES_ENIGMES, enGeoJSONEnigmes, sansLEnigme, SOURCE_ENIGMES } from '../lib/enigmes'

export type EnigmeTouchee = { id: number; x: number; y: number }

const AUCUNE: EnigmeEnAttente[] = []

export function useEnigmesSurLaCarte(
  carte: Carte | null,
  onToucher: (t: EnigmeTouchee) => void,
  cachee: number | null,
) {
  const { data } = useQuery({
    queryKey: ['enigmes-en-attente'],
    queryFn: fetchEnigmesEnAttente,
    enabled: carte !== null,
  })
  const enigmes = data ?? AUCUNE
  const dernieres = useRef(enigmes)
  const toucher = useRef(onToucher)
  useEffect(() => {
    toucher.current = onToucher
  })

  useEffect(() => {
    dernieres.current = enigmes
    void carte?.getSource<GeoJSONSource>(SOURCE_ENIGMES)?.setData(enGeoJSONEnigmes(enigmes))
  }, [carte, enigmes])

  useEffect(() => {
    for (const calque of CALQUES_ENIGMES) if (carte?.getLayer(calque)) carte.setFilter(calque, sansLEnigme(cachee))
  }, [carte, cachee])

  useEffect(() => {
    if (!carte) return
    const reposer = () => {
      void carte.getSource<GeoJSONSource>(SOURCE_ENIGMES)?.setData(enGeoJSONEnigmes(dernieres.current))
    }
    // Le sceau qui se retourne se pose sur le sceau de la carte, pas sous le doigt (un peu à côté).
    const surToucher = (e: MapLayerMouseEvent) => {
      const marque = e.features?.[0]
      const id: unknown = marque?.properties.id
      if (typeof id !== 'number') return
      const ou = marque?.geometry.type === 'Point' ? carte.project(marque.geometry.coordinates as [number, number]) : e.point
      toucher.current({ id, x: ou.x, y: ou.y })
    }
    carte.on('style.load', reposer)
    carte.on('click', CALQUE_SCEAUX_ENIGMES, surToucher)
    return () => {
      carte.off('style.load', reposer)
      carte.off('click', CALQUE_SCEAUX_ENIGMES, surToucher)
    }
  }, [carte])
}
