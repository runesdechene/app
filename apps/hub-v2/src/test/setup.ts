/**
 * QUOI     — préparation commune à tous les tests du Hub.
 * POURQUOI — vérifications DOM lisibles ; jsdom n'a ni matchMedia ni scrollTo, et MapLibre y est
 *            remplacé : il lui faut WebGL, que jsdom n'a pas.
 */
import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

vi.mock('maplibre-gl', async () => {
  const { FausseAttribution, FausseCarte, FausseMarque } = await import('./fausseCarte')
  return {
    Map: FausseCarte,
    Marker: FausseMarque,
    AttributionControl: FausseAttribution,
    setWorkerUrl: () => undefined,
  }
})
// Le worker de MapLibre, que Vite empaquette à part (shared/lib/maplibre.ts) : une adresse suffit.
vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url', () => ({ default: 'worker.js' }))

class FausseRequeteMedia extends EventTarget implements MediaQueryList {
  readonly matches = false
  onchange = null
  constructor(readonly media: string) {
    super()
  }
  addListener() {}
  removeListener() {}
}
window.matchMedia = (requete: string) => new FausseRequeteMedia(requete)
Element.prototype.scrollTo = () => undefined
