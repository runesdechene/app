/**
 * QUOI     — les territoires sur la carte (Figma 878:2627 → 877:2679) : leur forme, un blason par
 *            territoire, toujours là, et ce qu'ouvre un toucher — la carte de l'Explorateur qui le
 *            tient, puis « Renommer » sur le mien.
 * POURQUOI — chaque blason est un composant React rendu dans une marque MapLibre (`createPortal`) :
 *            MapLibre le déplace avec la carte, React le dessine comme le reste de l'appli.
 * ATTENTION — `carte` à null (visiteur) : ni forme, ni blason.
 */
import { maplibregl } from '@/shared/lib/maplibre'
import type { Map as Carte } from 'maplibre-gl'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CouleursCarte } from '@/shared/lib/couleursCarte'
import type { TerritoireRevendique } from '../api/lireCarte'
import { useTerritoiresSurLaCarte } from '../hooks/useTerritoiresSurLaCarte'
import { garderPourSoi } from '../lib/marquesActifs'
import { Blason } from './Blason'
import { CarteDExplorateur, type Etat } from './CarteExplorateur'
import { FeuilleRenommer } from './FeuilleRenommer'

function tient(t: TerritoireRevendique): Etat {
  return { texte: `Tient ${t.nom} · ${String(t.lieux)} lieux`, ton: t.moi ? 'mien' : 'autre' }
}

export function TerritoiresSurLaCarte({
  carte,
  couleurs,
}: {
  carte: Carte | null
  couleurs: CouleursCarte
}) {
  const territoires = useTerritoiresSurLaCarte(carte, couleurs)
  const [ouvert, setOuvert] = useState<{ id: string; renommer: boolean } | null>(null)
  const touche = territoires.find((t) => t.id === ouvert?.id)

  // Un élément par blason, refait quand les territoires changent ; la marque l'accroche à la carte.
  const places = useMemo(
    () =>
      territoires.map((t) => {
        const element = document.createElement('div')
        garderPourSoi(element)
        return { t, element }
      }),
    [territoires],
  )
  useEffect(() => {
    if (!carte) return
    const marques = places.map(({ t, element }) =>
      new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat(t.ancre).addTo(carte),
    )
    return () => {
      for (const m of marques) m.remove()
    }
  }, [carte, places])

  const fermer = () => {
    setOuvert(null)
  }
  const renommer = touche?.moi
    ? () => {
        setOuvert({ id: touche.id, renommer: true })
      }
    : undefined

  return (
    <>
      {places.map(({ t, element }) =>
        createPortal(
          <Blason
            territoire={t}
            onToucher={() => {
              setOuvert({ id: t.id, renommer: false })
            }}
          />,
          element,
          t.id,
        ),
      )}
      {touche && ouvert?.renommer && <FeuilleRenommer territoire={touche} onFermer={fermer} />}
      {touche && !ouvert?.renommer && (
        <CarteDExplorateur
          explorateur={touche.joueur}
          etat={tient(touche)}
          onFermer={fermer}
          onRenommer={renommer}
        />
      )}
    </>
  )
}
