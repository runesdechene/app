/**
 * QUOI     — les territoires revendiqués sur la carte : la couche se pose (`poserTerritoires`), reçoit
 *            leurs formes, et le hook rend les territoires (leurs blasons se posent à part).
 * POURQUOI — la clé vit sous celle des lieux : chaque geste qui relit les lieux (revendiquer,
 *            ajouter, découvrir, renommer) relit aussi les territoires, sans qu'aucun d'eux le sache.
 * ATTENTION — `carte` n'arrive qu'une fois son style chargé (CarteScreen) : les calques des lieux, sous
 *            lesquels la couche se glisse, sont déjà là. Un style rechargé efface tout : la couche s'y
 *            repose. `carte` à null (visiteur) : rien n'est demandé.
 */
import { useQuery } from '@tanstack/react-query'
import type { GeoJSONSource, Map as Carte } from 'maplibre-gl'
import { useEffect, useRef } from 'react'
import { fetchTerritoiresRevendiques } from '../api/carte'
import type { TerritoireRevendique } from '../api/lireCarte'
import { CALQUE_PILULES, filtrePilules } from '../lib/calques'
import { enGeoJSONTerritoires, poserTerritoires, SOURCE_TERRITOIRES } from '../lib/territoires'
import type { CouleursCarte } from '@/shared/lib/couleursCarte'
import { carteLieuxKey } from './useCarteLieux'

export const territoiresKey = [...carteLieuxKey, 'territoires']

const AUCUN: TerritoireRevendique[] = []

// Les formes, et le nom tu sous leurs lieux : la banderole du blason le porte.
function verser(carte: Carte, territoires: TerritoireRevendique[]) {
  void carte
    .getSource<GeoJSONSource>(SOURCE_TERRITOIRES)
    ?.setData(enGeoJSONTerritoires(territoires))
  carte.setFilter(CALQUE_PILULES, filtrePilules(territoires.flatMap((t) => t.ids)))
}

export function useTerritoiresSurLaCarte(
  carte: Carte | null,
  couleurs: CouleursCarte,
): TerritoireRevendique[] {
  const { data } = useQuery({
    queryKey: territoiresKey,
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

  return territoires
}
