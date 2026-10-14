/**
 * QUOI     — préparation commune à tous les tests du Hub.
 * POURQUOI — vérifications DOM lisibles ; jsdom n'a ni matchMedia ni scrollTo.
 */
import '@testing-library/jest-dom/vitest'

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
