/**
 * QUOI     — préparation commune à tous les tests.
 * POURQUOI — ajoute les vérifications DOM lisibles (toBeInTheDocument, toBeVisible…), et
 *            remplace MapLibre : il lui faut WebGL, que jsdom n'a pas. Tout test qui monte la
 *            coquille monte aussi l'onglet Carte. jsdom n'a pas non plus ResizeObserver,
 *            Element.scrollTo, matchMedia ni de canevas qui dessine : des faux, muets, en tiennent
 *            lieu (un test peut les remplacer).
 */
import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

vi.mock('maplibre-gl', async () => {
  const { FausseCarte, FausseMarque } = await import('./fausseCarte')
  return { Map: FausseCarte, Marker: FausseMarque }
})

class FauxResizeObserver implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = FauxResizeObserver

// Toucher l'onglet déjà actif remonte son écran : jsdom ne sait pas défiler.
Element.prototype.scrollTo = () => undefined

// Aucune préférence d'affichage (animations réduites, thème) : jsdom ne connaît pas matchMedia.
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

// jsdom ne dessine pas : un canevas sans contexte (le voile d'un lieu inconnu ne peint rien).
HTMLCanvasElement.prototype.getContext = () => null

// Sans AnimationEvent, React écoute la fin d'une animation sous un nom préfixé que les tests
// n'envoient pas (fireEvent.animationEnd).
class FauxAnimationEvent extends Event implements AnimationEvent {
  readonly animationName = ''
  readonly elapsedTime = 0
  readonly pseudoElement = ''
}
globalThis.AnimationEvent = FauxAnimationEvent

// jsdom ne crée pas d'adresse blob: pour une image (les photos du brouillon d'un lieu).
URL.createObjectURL = () => 'blob:test'
URL.revokeObjectURL = () => undefined
