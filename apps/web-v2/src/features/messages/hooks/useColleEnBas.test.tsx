/**
 * QUOI     — une liste de messages reste collée en bas : à l'ouverture, quand elle devient
 *            visible (écran gardé monté), à chaque message ; sauf si l'on est remonté lire.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useColleEnBas } from './useColleEnBas'

// jsdom ne calcule aucune hauteur : une liste de 500 px de contenu, 100 px visibles.
let hauteur = 500
let visible = 100
let redimensionner: () => void = () => undefined

beforeEach(() => {
  hauteur = 500
  visible = 100
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(() => hauteur)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => visible)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(rappel: () => void) {
        redimensionner = rappel
      }
      // Comme le vrai : un premier rappel dès qu'il commence à observer.
      observe() {
        redimensionner()
      }
      disconnect() {}
    },
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function Liste({ messages }: { messages: string[] }) {
  const coller = useColleEnBas()
  return (
    <ol ref={coller} data-testid="liste">
      {messages.map((m) => (
        <li key={m}>{m}</li>
      ))}
    </ol>
  )
}

test('à l’ouverture, la liste est en bas', () => {
  render(<Liste messages={['a']} />)
  expect(screen.getByTestId('liste').scrollTop).toBe(500)
})

test('devenue visible (l’écran était caché), elle va en bas, même après un défilement du navigateur', () => {
  visible = 0 // monté caché
  render(<Liste messages={['a']} />)
  const liste = screen.getByTestId('liste')
  visible = 100
  // Chrome, en l'affichant, la remet en haut et envoie un défilement avant de la mesurer.
  liste.scrollTop = 0
  fireEvent.scroll(liste)
  act(() => {
    redimensionner()
  })
  expect(liste.scrollTop).toBe(500)
})

test('un nouveau message la ramène en bas', async () => {
  const { rerender } = render(<Liste messages={['a']} />)
  const liste = screen.getByTestId('liste')
  hauteur = 600
  rerender(<Liste messages={['a', 'b']} />)
  await vi.waitFor(() => {
    expect(liste.scrollTop).toBe(600)
  })
})

test('remonté pour lire, on n’est pas tiré vers le bas par un nouveau message', async () => {
  const { rerender } = render(<Liste messages={['a']} />)
  const liste = screen.getByTestId('liste')
  liste.scrollTop = 50
  fireEvent.scroll(liste)
  hauteur = 600
  rerender(<Liste messages={['a', 'b']} />)
  await new Promise((r) => setTimeout(r, 0))
  expect(liste.scrollTop).toBe(50)
})
