/**
 * QUOI     — le lieu sous la souris : la main, le lieu qui grossit un peu, et au clic un petit
 *            enfoncement (il rétrécit puis revient) — Uriel, 28/09.
 * POURQUOI — la taille d'une icône est une propriété de mise en page : MapLibre ne l'anime pas et
 *            elle ne peut dépendre d'un état. Un calque ne dessine que le lieu survolé ; on fait
 *            varier sa taille image par image (requestAnimationFrame), 150 à 250 ms.
 * ATTENTION — au doigt, pas de survol : le clic seul fait pulser le lieu touché.
 */
import type { FilterSpecification, Map as Carte, MapLayerMouseEvent } from 'maplibre-gl'
import { CALQUE_SURVOL, TAILLE } from './calques'

const SURVOLE = 1.2
const ENFONCE = 0.85
const AUCUN: FilterSpecification = ['==', ['get', 'id'], '']

const animationsReduites = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function suivreSurvol(map: Carte, calques: string[]) {
  let echelle = 1
  let courant = ''
  let image = 0

  const poser = (facteur: number) => {
    echelle = facteur
    map.setLayoutProperty(CALQUE_SURVOL, 'icon-size', ['*', TAILLE, facteur])
  }

  // Passe d'échelle en échelle (ex. [0,85, 1,2]) en `duree` ms.
  const animer = (etapes: number[], duree: number) => {
    cancelAnimationFrame(image)
    const points = [echelle, ...etapes]
    if (animationsReduites()) {
      poser(points[points.length - 1] ?? 1)
      return
    }
    const debut = performance.now()
    const pas = (maintenant: number) => {
      const avance = Math.min(1, (maintenant - debut) / duree) * (points.length - 1)
      const i = Math.min(Math.floor(avance), points.length - 2)
      const de = points[i] ?? 1
      const a = points[i + 1] ?? 1
      poser(de + (a - de) * (avance - i))
      if (avance < points.length - 1) image = requestAnimationFrame(pas)
    }
    image = requestAnimationFrame(pas)
  }

  const montrer = (e: MapLayerMouseEvent) => {
    const id: unknown = e.features?.[0]?.properties.id
    if (typeof id !== 'string' || id === courant) return
    courant = id
    map.setFilter(CALQUE_SURVOL, ['==', ['get', 'id'], id])
    poser(1)
    animer([SURVOLE], 150)
  }

  map.on('mousemove', calques, (e) => {
    map.getCanvas().style.cursor = 'pointer'
    montrer(e)
  })
  map.on('mouseleave', calques, () => {
    map.getCanvas().style.cursor = ''
    cancelAnimationFrame(image)
    courant = ''
    map.setFilter(CALQUE_SURVOL, AUCUN)
  })
  map.on('click', calques, (e) => {
    montrer(e)
    animer([ENFONCE, SURVOLE], 250)
  })
}
