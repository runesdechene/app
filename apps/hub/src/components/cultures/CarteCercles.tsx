/**
 * QUOI     — la carte d'une culture dans le Hub : ses cercles (un clic pose un centre), et les « ? »
 *            éveillés en ce moment (points rouges).
 * POURQUOI — on règle la zone à l'œil, et on voit où tombent vraiment les énigmes.
 */
import { useEffect, useRef, useState } from 'react'
import type { GeoJSONSource, Map as CarteMaplibre } from 'maplibre-gl'
import { maplibregl } from '../../lib/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { cercleEnPolygone, type Cercle } from '../../lib/cercles'

const FOND = 'https://tiles.openfreemap.org/styles/positron'

export function CarteCercles({
  cercles,
  eveils,
  couleur,
  onPoser,
}: {
  cercles: Cercle[]
  eveils: { lat: number; lng: number }[]
  couleur: string
  onPoser: (lat: number, lng: number) => void
}) {
  const conteneur = useRef<HTMLDivElement>(null)
  const [carte, setCarte] = useState<CarteMaplibre | null>(null)
  const poser = useRef(onPoser)
  poser.current = onPoser

  useEffect(() => {
    if (!conteneur.current) return
    const map = new maplibregl.Map({ container: conteneur.current, style: FOND, center: [15, 50], zoom: 3 })
    map.on('load', () => {
      map.addSource('cercles', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addSource('eveils', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'cercles', type: 'fill', source: 'cercles', paint: { 'fill-color': couleur, 'fill-opacity': 0.15 } })
      map.addLayer({ id: 'cercles-bord', type: 'line', source: 'cercles', paint: { 'line-color': couleur, 'line-dasharray': [2, 2] } })
      map.addLayer({ id: 'eveils', type: 'circle', source: 'eveils', paint: { 'circle-radius': 5, 'circle-color': '#a94842', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } })
      setCarte(map)
    })
    map.on('click', (e) => {
      poser.current(e.lngLat.lat, e.lngLat.lng)
    })
    return () => {
      setCarte(null)
      map.remove()
    }
  }, [couleur])

  useEffect(() => {
    if (!carte) return
    carte.getSource<GeoJSONSource>('cercles')?.setData({
      type: 'FeatureCollection',
      features: cercles.map((c) => ({ type: 'Feature', properties: {}, geometry: cercleEnPolygone(c) })),
    })
    carte.getSource<GeoJSONSource>('eveils')?.setData({
      type: 'FeatureCollection',
      features: eveils.map((p) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } })),
    })
  }, [carte, cercles, eveils])

  return <div ref={conteneur} className="cultures-carte" />
}
