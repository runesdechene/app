/**
 * QUOI     — les territoires sur la carte (`poserTerritoires`) et « Renommer » (Figma 877:2679) :
 *            un clic sur le nom d'un territoire que je tiens ouvre la feuille.
 * POURQUOI — seuls ceux qui le tiennent le renomment (la base le refuse aux autres, migration 575) :
 *            sur le nom d'un autre, le clic ne fait rien, et la main n'apparaît que sur les miens.
 * ATTENTION — `carte` à null (visiteur) : rien n'est demandé ni posé.
 */
import type { Map as Carte, MapLayerMouseEvent } from 'maplibre-gl'
import { useEffect, useState } from 'react'
import type { CouleursCarte } from '@/shared/lib/couleursCarte'
import { useTerritoiresSurLaCarte } from '../hooks/useTerritoiresSurLaCarte'
import { CALQUE_NOMS_TERRITOIRES } from '../lib/territoires'
import { FeuilleRenommer } from './FeuilleRenommer'

// Le territoire sous le pointeur, s'il est à moi.
function mienSous(e: MapLayerMouseEvent): string | null {
  const proprietes = e.features?.[0]?.properties
  return proprietes?.moi === true && typeof proprietes.id === 'string' ? proprietes.id : null
}

export function TerritoiresSurLaCarte({
  carte,
  couleurs,
}: {
  carte: Carte | null
  couleurs: CouleursCarte
}) {
  const territoires = useTerritoiresSurLaCarte(carte, couleurs)
  const [ouvert, setOuvert] = useState<string | null>(null)
  const territoire = territoires.find((t) => t.id === ouvert)

  useEffect(() => {
    if (!carte) return
    const toucher = (e: MapLayerMouseEvent) => {
      const id = mienSous(e)
      if (id) setOuvert(id)
    }
    // La main sur mes noms seulement ; ailleurs, on laisse le curseur à qui l'a posé (un lieu).
    const survoler = (e: MapLayerMouseEvent) => {
      if (mienSous(e)) carte.getCanvas().style.cursor = 'pointer'
    }
    const quitter = () => {
      carte.getCanvas().style.cursor = ''
    }
    carte.on('click', CALQUE_NOMS_TERRITOIRES, toucher)
    carte.on('mousemove', CALQUE_NOMS_TERRITOIRES, survoler)
    carte.on('mouseleave', CALQUE_NOMS_TERRITOIRES, quitter)
    return () => {
      carte.off('click', CALQUE_NOMS_TERRITOIRES, toucher)
      carte.off('mousemove', CALQUE_NOMS_TERRITOIRES, survoler)
      carte.off('mouseleave', CALQUE_NOMS_TERRITOIRES, quitter)
    }
  }, [carte])

  return territoire ? (
    <FeuilleRenommer
      territoire={territoire}
      onFermer={() => {
        setOuvert(null)
      }}
    />
  ) : null
}
