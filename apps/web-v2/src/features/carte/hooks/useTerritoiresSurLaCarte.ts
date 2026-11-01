/**
 * QUOI     — les territoires revendiqués sur la carte : la couche se pose (`poserTerritoires`), puis
 *            reçoit les territoires.
 * POURQUOI — la clé vit sous celle des lieux : chaque geste qui relit les lieux (revendiquer,
 *            ajouter, découvrir) relit aussi les territoires, sans qu'aucun d'eux le sache.
 * ATTENTION — `carte` n'arrive qu'une fois son style chargé (CarteScreen) : les calques des lieux, sous
 *            lesquels la couche se glisse, sont déjà là. Un style rechargé efface tout : la couche s'y
 *            repose. `carte` à null (visiteur) : rien n'est demandé.
 */
import { useQuery } from '@tanstack/react-query'
import type { GeoJSONSource, Map as Carte } from 'maplibre-gl'
import { useEffect, useRef } from 'react'
import { fetchTerritoiresRevendiques } from '../api/carte'
import type { TerritoireRevendique } from '../api/lireCarte'
import { enGeoJSONTerritoires, poserTerritoires, SOURCE_TERRITOIRES } from '../lib/territoires'
import type { CouleursCarte } from '@/shared/lib/couleursCarte'
import { carteLieuxKey } from './useCarteLieux'

const AUCUN: TerritoireRevendique[] = []

function verser(carte: Carte, territoires: TerritoireRevendique[]) {
  void carte
    .getSource<GeoJSONSource>(SOURCE_TERRITOIRES)
    ?.setData(enGeoJSONTerritoires(territoires))
}

export function useTerritoiresSurLaCarte(carte: Carte | null, couleurs: CouleursCarte) {
  const { data } = useQuery({
    queryKey: [...carteLieuxKey, 'territoires'],
    queryFn: fetchTerritoiresRevendiques,
    enabled: carte !== null,
  })
  const territoires = data ?? AUCUN
  const derniers = useRef(territoires)

  useEffect(() => {
    derniers.current = territoires
    if (carte) verser(carte, territoires)
  }, [carte, territoires])

  useEffect(() => {
    if (!carte) return
    const poser = () => {
      poserTerritoires(carte, couleurs)
      verser(carte, derniers.current)
    }
    poser()
    carte.on('style.load', poser)
    return () => {
      carte.off('style.load', poser)
    }
  }, [carte, couleurs])
}
