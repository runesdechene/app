/**
 * QUOI     — une fausse carte MapLibre pour les tests : elle retient ses écouteurs, et le test
 *            déclenche lui-même « load », « zoomend »…
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
  easeTo = vi.fn()

  constructor() {
    FausseCarte.derniere = this
  }

  on(type: string, calqueOuEcouteur: unknown, ecouteur?: Ecouteur) {
    const f = typeof calqueOuEcouteur === 'function' ? (calqueOuEcouteur as Ecouteur) : ecouteur
    if (f) this.ecouteurs.set(type, [...(this.ecouteurs.get(type) ?? []), f])
  }

  emettre(type: string) {
    for (const f of this.ecouteurs.get(type) ?? []) f()
  }

  setStyle() {}
  remove() {}
  addSource() {}
  addLayer() {}
  getSource() {
    return this.source
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
