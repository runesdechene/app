/**
 * QUOI     — la carte où l'on dessine les cercles d'une culture : un clic en ajoute un, chaque cercle a
 *            son curseur de rayon et son « Retirer » ; les « ? » déjà éveillés y sont des points rouges.
 * POURQUOI — le composant ne parle pas à Supabase : il reçoit les cercles et rend le nouveau tableau.
 *            MapLibre dessine dans un canevas, donc la couleur d'accent est lue dans le jeton CSS.
 */
import { useEffect, useRef } from 'react'
import { maplibregl, STYLE_DE_CARTE } from '@/shared/lib/maplibre'
import { cercleEnPolygone, KM_PAR_DEGRE, type Cercle } from '../lib/cercle'
import styles from './Cultures.module.css'

type Eveil = { lat: number; lng: number }
const FRANCE = { center: [2.4, 46.6] as [number, number], zoom: 4 }

const polygones = (cercles: Cercle[]) => ({
  type: 'FeatureCollection' as const,
  features: cercles.map((c) => ({
    type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [cercleEnPolygone(c)] },
  })),
})
const points = (eveils: Eveil[]) => ({
  type: 'FeatureCollection' as const,
  features: eveils.map((e) => ({
    type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: [e.lng, e.lat] },
  })),
})

// La carte s'ouvre sur les cercles (leur boîte), ou sur la France s'il n'y en a pas.
function cadrage(cercles: Cercle[]) {
  if (cercles.length === 0) return FRANCE
  const lat = cercles.flatMap((c) => [c.lat - c.rayon_km / KM_PAR_DEGRE, c.lat + c.rayon_km / KM_PAR_DEGRE])
  const lng = cercles.flatMap((c) => {
    const d = c.rayon_km / KM_PAR_DEGRE / Math.cos((c.lat * Math.PI) / 180)
    return [c.lng - d, c.lng + d]
  })
  return { bounds: [[Math.min(...lng), Math.min(...lat)], [Math.max(...lng), Math.max(...lat)]] as [[number, number], [number, number]] }
}

type Alimentable = { setData: (donnees: GeoJsonDonnees) => void }
type GeoJsonDonnees = ReturnType<typeof polygones> | ReturnType<typeof points>
const sAlimente = (source: object | undefined): source is Alimentable => source !== undefined && 'setData' in source

function poser(carte: maplibregl.Map, source: string, donnees: GeoJsonDonnees) {
  const s = carte.getSource(source)
  if (sAlimente(s)) s.setData(donnees)
}

type Props = { cercles: Cercle[]; eveils: Eveil[]; couleur: string | null; onChange: (cercles: Cercle[]) => void }

export function CarteDesCercles({ cercles, eveils, couleur, onChange }: Props) {
  const conteneur = useRef<HTMLDivElement>(null)
  const carte = useRef<maplibregl.Map | null>(null)
  const prete = useRef(false)
  const accent = useRef('')
  // Les écouteurs de la carte sont posés une fois : ils lisent toujours les dernières valeurs.
  const dernier = useRef({ cercles, eveils, couleur, onChange })
  useEffect(() => {
    dernier.current = { cercles, eveils, couleur, onChange }
  })

  useEffect(() => {
    if (!conteneur.current) return
    const m = new maplibregl.Map({ container: conteneur.current, style: STYLE_DE_CARTE, ...cadrage(dernier.current.cercles) })
    carte.current = m
    m.on('load', () => {
      accent.current = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim()
      const trait = dernier.current.couleur ?? accent.current
      m.addSource('cercles', { type: 'geojson', data: polygones(dernier.current.cercles) })
      m.addSource('eveils', { type: 'geojson', data: points(dernier.current.eveils) })
      m.addLayer({ id: 'cercles-fond', type: 'fill', source: 'cercles', paint: { 'fill-color': trait, 'fill-opacity': 0.15 } })
      m.addLayer({ id: 'cercles-bord', type: 'line', source: 'cercles', paint: { 'line-color': trait, 'line-width': 2 } })
      m.addLayer({ id: 'eveils', type: 'circle', source: 'eveils', paint: { 'circle-color': accent.current, 'circle-radius': 5 } })
      prete.current = true
    })
    m.on('click', (e) => {
      // La base n'accepte que des latitudes de −80 à 80 ; la longitude revient dans −180..180.
      const { lat, lng } = e.lngLat.wrap()
      if (Math.abs(lat) > 80) return
      dernier.current.onChange([...dernier.current.cercles, { lat, lng, rayon_km: 50 }])
    })
    return () => {
      prete.current = false
      m.remove()
    }
  }, [])

  useEffect(() => {
    if (carte.current && prete.current) poser(carte.current, 'cercles', polygones(cercles))
  }, [cercles])
  useEffect(() => {
    if (!carte.current || !prete.current) return
    carte.current.setPaintProperty('cercles-fond', 'fill-color', couleur ?? accent.current)
    carte.current.setPaintProperty('cercles-bord', 'line-color', couleur ?? accent.current)
  }, [couleur])
  useEffect(() => {
    if (carte.current && prete.current) poser(carte.current, 'eveils', points(eveils))
  }, [eveils])

  return (
    <div>
      <div ref={conteneur} className={styles.carte} />
      <div className={styles.cercles}>
        {cercles.map((c, i) => (
          <div key={i} className={styles.unCercle}>
            <span>{`${c.lat.toFixed(2)}, ${c.lng.toFixed(2)}`}</span>
            <input type="range" min={5} max={1000} step={5} value={c.rayon_km} aria-label={`Rayon du cercle ${String(i + 1)}`}
              onChange={(e) => { onChange(cercles.map((v, j) => (j === i ? { ...v, rayon_km: Number(e.target.value) } : v))) }} />
            <span>{`${String(c.rayon_km)} km`}</span>
            <button type="button" onClick={() => { onChange(cercles.filter((_, j) => j !== i)) }}>Retirer</button>
          </div>
        ))}
      </div>
    </div>
  )
}
