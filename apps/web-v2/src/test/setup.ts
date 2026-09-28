/**
 * QUOI     — préparation commune à tous les tests.
 * POURQUOI — ajoute les vérifications DOM lisibles (toBeInTheDocument, toBeVisible…), et
 *            remplace MapLibre : il lui faut WebGL, que jsdom n'a pas. Tout test qui monte la
 *            coquille monte aussi l'onglet Carte.
 */
import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

class FausseCarte {
  on() {}
  once() {}
  setStyle() {}
  setTerrain() {}
  remove() {}
}

vi.mock('maplibre-gl', () => ({ default: { Map: FausseCarte } }))
