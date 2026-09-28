/**
 * QUOI     — préparation commune à tous les tests.
 * POURQUOI — ajoute les vérifications DOM lisibles (toBeInTheDocument, toBeVisible…), et
 *            remplace MapLibre : il lui faut WebGL, que jsdom n'a pas. Tout test qui monte la
 *            coquille monte aussi l'onglet Carte. jsdom n'a pas non plus ResizeObserver ni
 *            Element.scrollTo : des faux, muets, en tiennent lieu (un test peut les remplacer).
 */
import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

vi.mock('maplibre-gl', async () => {
  const { FausseCarte } = await import('./fausseCarte')
  return { default: { Map: FausseCarte } }
})

class FauxResizeObserver implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = FauxResizeObserver

// Toucher l'onglet déjà actif remonte son écran : jsdom ne sait pas défiler.
Element.prototype.scrollTo = () => undefined
