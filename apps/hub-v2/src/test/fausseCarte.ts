/**
 * QUOI     — une fausse carte MapLibre pour les tests : elle retient ses écouteurs, et le test
 *            déclenche lui-même « style.load », « zoomend »…
 * POURQUOI — MapLibre a besoin de WebGL, que jsdom n'a pas. `setup.ts` la met à la place de la
 *            vraie pour tous les tests.
 */
import { vi } from 'vitest'

type Ecouteur = (e?: unknown) => void

export class FausseCarte {
  static derniere: FausseCarte | null = null
  ecouteurs = new Map<string, Ecouteur[]>()
  inclinaison = 0
  zoom = 5
  terrain: unknown = null
  source = { setData: vi.fn(), getClusterExpansionZoom: vi.fn() }
  setTerrain = vi.fn((terrain: unknown) => {
    this.terrain = terrain
  })
  flyTo = vi.fn()
  jumpTo = vi.fn()
  easeTo = vi.fn()

  options: unknown

  constructor(options?: unknown) {
    this.options = options
    FausseCarte.derniere = this
  }

  on(type: string, calqueOuEcouteur: unknown, ecouteur?: Ecouteur) {
    const f = typeof calqueOuEcouteur === 'function' ? (calqueOuEcouteur as Ecouteur) : ecouteur
    if (f) this.ecouteurs.set(type, [...(this.ecouteurs.get(type) ?? []), f])
  }

  off(type: string, calqueOuEcouteur: unknown, ecouteur?: Ecouteur) {
    const f = typeof calqueOuEcouteur === 'function' ? calqueOuEcouteur : ecouteur
    this.ecouteurs.set(
      type,
      (this.ecouteurs.get(type) ?? []).filter((e) => e !== f),
    )
  }

  conteneur = document.createElement('div')
  getContainer() {
    return this.conteneur
  }

  emettre(type: string, evenement?: unknown) {
    for (const f of this.ecouteurs.get(type) ?? []) f(evenement)
  }

  canevas = { style: { cursor: '' } }
  setFilter = vi.fn()
  setLayoutProperty = vi.fn()
  setPaintProperty = vi.fn()
  getCanvas() {
    return this.canevas
  }

  setStyle = vi.fn<(style: unknown, options?: unknown) => void>()
  addControl = vi.fn<(controle: unknown, coin?: string) => void>()
  moveLayer = vi.fn()
  remove() {}
  addSource = vi.fn()
  queryRenderedFeatures = vi.fn<(...args: unknown[]) => unknown[]>(() => [])
  hasImage = vi.fn<(nom: string) => boolean>(() => false)
  addImage = vi.fn()
  calquesPoses = new Set<string>()
  addLayer = vi.fn((calque: { id: string }) => {
    this.calquesPoses.add(calque.id)
  })
  getLayer(id: string): unknown {
    return this.calquesPoses.has(id) ? { id } : undefined
  }
  getStyle() {
    return { layers: [] }
  }
  // La source des lieux est `source` ; toute autre (les zones des Actifs) a la sienne.
  autresSources = new Map<string, { setData: ReturnType<typeof vi.fn> }>()
  getSource(id: string) {
    if (id === 'lieux') return this.source
    const autre = this.autresSources.get(id) ?? { setData: vi.fn() }
    this.autresSources.set(id, autre)
    return autre
  }
  getCenter() {
    return { lat: 46.6, lng: 2.4 }
  }
  getZoom() {
    return this.zoom
  }
  getPitch() {
    return this.inclinaison
  }
  getTerrain() {
    return this.terrain
  }
}

// Un faux contrôle d'attribution : il garde ses options, pour que le test les lise.
export class FausseAttribution {
  constructor(readonly options?: unknown) {}
}

// Une fausse marque MapLibre : son élément est posé dans la page, pour que le test le touche.
export class FausseMarque {
  element: HTMLElement
  constructor({ element }: { element: HTMLElement }) {
    this.element = element
  }
  setLngLat() {
    return this
  }
  addTo() {
    document.body.append(this.element)
    return this
  }
  remove() {
    this.element.remove()
    return this
  }
}
