/**
 * QUOI     — la carte des origines des Fragments : un marqueur (l'illustration, ou l'initiale) par Fragment
 *            posé, le Fragment ouvert en avant ; un clic sur la carte pose son point d'origine.
 * POURQUOI — le composant ne parle pas à Supabase : il reçoit les points et rend le clic. La carte est créée
 *            une fois, ses écouteurs lisent la dernière fonction reçue ; les marqueurs sont refaits à
 *            chaque changement de points.
 */
import { useEffect, useRef } from 'react'
import { maplibregl, STYLE_DE_CARTE } from '@/shared/lib/maplibre'
import styles from './Boutique.module.css'

type Point = { id: number; lat: number; lng: number; image: string | null; nom: string }

function pastille(point: Point, choisi: boolean): HTMLElement {
  const el = document.createElement('div')
  el.className = choisi ? 'pastilleDOrigine pastilleDOrigineChoisie' : 'pastilleDOrigine'
  if (point.image) el.style.setProperty('--image', `url("${point.image}")`)
  else el.textContent = point.nom.charAt(0).toUpperCase()
  return el
}

export function CarteDOrigine({ points, choisi, onPoser }: { points: Point[]; choisi: number; onPoser: (lat: number, lng: number) => void }) {
  const conteneur = useRef<HTMLDivElement>(null)
  const carte = useRef<maplibregl.Map | null>(null)
  const surClic = useRef(onPoser)
  useEffect(() => {
    surClic.current = onPoser
  })

  useEffect(() => {
    if (!conteneur.current) return
    const m = new maplibregl.Map({ container: conteneur.current, style: STYLE_DE_CARTE, center: [12, 46], zoom: 3 })
    carte.current = m
    m.on('click', (e) => {
      // La base n'accepte que des latitudes de −80 à 80 ; la longitude revient dans −180..180.
      const { lat, lng } = e.lngLat.wrap()
      if (Math.abs(lat) > 80) return
      surClic.current(lat, lng)
    })
    return () => {
      m.remove()
    }
  }, [])

  useEffect(() => {
    const m = carte.current
    if (!m) return
    const marqueurs = points.map((p) =>
      new maplibregl.Marker({ element: pastille(p, p.id === choisi) }).setLngLat([p.lng, p.lat]).addTo(m),
    )
    return () => {
      marqueurs.forEach((marqueur) => marqueur.remove())
    }
  }, [points, choisi])

  return <div ref={conteneur} className={styles.carteDOrigine} />
}
