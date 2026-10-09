/**
 * QUOI     — la carte d'origine d'un Fragment : un clic pose son point, qui s'affiche avec la petite
 *            icône de son illustration, comme il flottera dans Explore. Les autres Fragments déjà
 *            placés restent visibles, en retrait.
 * POURQUOI — décision du 08/10 : un point d'origine par Fragment, posé ici, à l'œil.
 */
import { useEffect, useRef, useState } from 'react'
import type { Map as CarteMaplibre, Marker } from 'maplibre-gl'
import { maplibregl } from '../../lib/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

const FOND = 'https://tiles.openfreemap.org/styles/positron'

export interface PointFragment {
  id: number
  lat: number
  lng: number
  image: string | null
  nom: string
}

function pastille(p: PointFragment, choisi: boolean): HTMLElement {
  const el = document.createElement('div')
  el.className = choisi ? 'frag-pin frag-pin--choisi' : 'frag-pin'
  el.title = p.nom
  if (p.image) el.style.backgroundImage = `url("${p.image}")`
  else el.textContent = p.nom.charAt(0)
  return el
}

export function CarteOrigine({
  points,
  choisi,
  onPoser,
}: {
  points: PointFragment[]
  choisi: number
  onPoser: (lat: number, lng: number) => void
}) {
  const conteneur = useRef<HTMLDivElement>(null)
  const [carte, setCarte] = useState<CarteMaplibre | null>(null)
  const poser = useRef(onPoser)
  poser.current = onPoser

  useEffect(() => {
    if (!conteneur.current) return
    const map = new maplibregl.Map({ container: conteneur.current, style: FOND, center: [12, 46], zoom: 3 })
    map.on('load', () => setCarte(map))
    map.on('click', (e) => poser.current(e.lngLat.lat, e.lngLat.lng))
    return () => {
      setCarte(null)
      map.remove()
    }
  }, [])

  useEffect(() => {
    if (!carte) return
    const marqueurs: Marker[] = points.map((p) =>
      new maplibregl.Marker({ element: pastille(p, p.id === choisi) }).setLngLat([p.lng, p.lat]).addTo(carte),
    )
    return () => marqueurs.forEach((m) => m.remove())
  }, [carte, points, choisi])

  return <div ref={conteneur} className="frag-carte" />
}
