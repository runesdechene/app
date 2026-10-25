import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { RoseDesVents } from './RoseDesVents'

// Une carte réduite à ce que la rose écoute : son cap, l'événement `rotate`, le retour au nord.
function fausseCarte() {
  let cap = 0
  const ecouteurs: (() => void)[] = []
  return {
    getBearing: () => cap,
    on: (_: string, f: () => void) => ecouteurs.push(f),
    off: vi.fn(),
    resetNorth: vi.fn(),
    tourner(degres: number) {
      cap = degres
      for (const f of ecouteurs) f()
    },
  }
}

test('la rose tourne à l’inverse de la carte, et la toucher remet le nord en haut', () => {
  const carte = fausseCarte()
  render(<RoseDesVents carte={carte} />)
  const bouton = screen.getByRole('button', { name: 'Remettre le nord en haut' })
  carte.tourner(30)
  expect(bouton.querySelector('img')?.style.rotate).toBe('-30deg')
  fireEvent.click(bouton)
  expect(carte.resetNorth).toHaveBeenCalled()
})
