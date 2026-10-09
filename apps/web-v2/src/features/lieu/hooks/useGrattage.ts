/**
 * QUOI     — gratter le voile d'un lieu inconnu : le doigt (ou la souris qui passe, sans clic) le
 *            déchire ; passé la moitié, `onMoitie` est appelé une seule fois.
 * POURQUOI — le voile se peint tout de suite en lavis (la photo nette ne se voit jamais), puis
 *            une seconde fois quand la photo et le parchemin sont chargés — sauf si l'on a déjà
 *            commencé à gratter.
 * ATTENTION — le canevas compte en pixels de l'écran (×devicePixelRatio, pour rester net) ; la
 *            grille qui mesure la part grattée compte en pixels CSS.
 */
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import parcheminUrl from '@/assets/ui/fond-fiche.webp'
import { Grille, jalons, type Point } from '../lib/dechirure'
import { dechirer, peindreVoile } from '../lib/voile'

// La gomme, en pixels CSS : un doigt, ou la souris — plus large, on la passe sans appuyer
// (Uriel, 28/09).
const RAYON = { doigt: 30, souris: 55 }
const MOITIE = 0.5

function charger(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      resolve(image)
    }
    image.onerror = reject
    image.src = src
  })
}

export function useGrattage(photoUrl: string | null, onMoitie: () => void) {
  const canevas = useRef<HTMLCanvasElement>(null)
  const grille = useRef(new Grille(1, 1))
  const dernier = useRef<Point | null>(null)
  const commence = useRef(false)
  const fini = useRef(false)
  const [gratte, setGratte] = useState(false)

  useEffect(() => {
    const c = canevas.current
    if (!c) return
    const { width, height } = c.getBoundingClientRect()
    const ratio = window.devicePixelRatio
    c.width = Math.round(width * ratio)
    c.height = Math.round(height * ratio)
    grille.current = new Grille(width, height)
    peindreVoile(c, null, null)
    let annule = false
    void Promise.all([
      photoUrl ? charger(photoUrl).catch(() => null) : null,
      charger(parcheminUrl).catch(() => null),
    ]).then(([photo, parchemin]) => {
      if (!annule && !commence.current) peindreVoile(c, photo, parchemin)
    })
    return () => {
      annule = true
    }
  }, [photoUrl])

  const gratter = (e: PointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget
    if (fini.current) return
    commence.current = true
    setGratte(true)
    const cadre = c.getBoundingClientRect()
    const ici = { x: e.clientX - cadre.left, y: e.clientY - cadre.top }
    const ratio = c.width / cadre.width
    const rayon = e.pointerType === 'mouse' ? RAYON.souris : RAYON.doigt
    const points = dernier.current ? jalons(dernier.current, ici, rayon / 2) : [ici]
    for (const p of points) {
      dechirer(c, { x: p.x * ratio, y: p.y * ratio }, rayon * ratio)
      grille.current.gratter(p, rayon)
    }
    dernier.current = ici
    if (grille.current.part() >= MOITIE) {
      fini.current = true
      onMoitie()
    }
  }

  const lever = () => {
    dernier.current = null
  }

  return { canevas, gratte, gratter, lever }
}
