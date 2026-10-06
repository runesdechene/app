/**
 * QUOI     — mes pins sur la carte : leurs données à jour, un toucher qui rend l'id du pin, et le vol
 *            jusqu'au pin demandé (« Voir sur la carte »).
 * POURQUOI — CarteScreen dit seulement quoi montrer ; la couche elle-même se pose dans son
 *            `style.load` (`poserMesPins`).
 * ATTENTION — `pret` : le tiroir est mesuré, sinon son décalage couperait le vol. Le vol dit
 *            `onCentre` une fois parti, pour que l'app retire la demande (elle ne revole pas).
 *            `carte` à null (visiteur) : rien n'est montré, rien ne se touche.
 */
import type { GeoJSONSource, Map as Carte } from 'maplibre-gl'
import { useEffect, useRef } from 'react'
import { enGeoJSONPins, MES_PINS, type PinsDeLaCarte } from '../lib/mesPins'

const ZOOM_PIN = 16

export function useMesPinsSurLaCarte(
  carte: Carte | null,
  { mesPins = [], onToucherPin, centrerSur, onCentre }: PinsDeLaCarte,
  pret: boolean,
) {
  useEffect(() => {
    void carte?.getSource<GeoJSONSource>(MES_PINS)?.setData(enGeoJSONPins(mesPins))
  }, [carte, mesPins])

  const toucher = useRef(onToucherPin)
  const fin = useRef(onCentre)
  useEffect(() => {
    toucher.current = onToucherPin
    fin.current = onCentre
  })
  useEffect(() => {
    if (!carte) return
    const ouvrir = (e: { features?: { properties: Record<string, unknown> }[] }) => {
      const id: unknown = e.features?.[0]?.properties.id
      if (typeof id === 'string') toucher.current?.(id)
    }
    carte.on('click', MES_PINS, ouvrir)
    return () => {
      carte.off('click', MES_PINS, ouvrir)
    }
  }, [carte])

  const lat = centrerSur?.latitude
  const lng = centrerSur?.longitude
  useEffect(() => {
    if (!carte || !pret || lat === undefined || lng === undefined) return
    carte.flyTo({ center: [lng, lat], zoom: ZOOM_PIN })
    fin.current?.()
  }, [carte, pret, lat, lng])
}
