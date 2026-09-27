/**
 * QUOI     — test de fumée : l'app se monte et affiche son nom.
 * POURQUOI — prouve que l'outillage (Vite, TS, Vitest, jsdom) tient debout avant tout le reste.
 */
import { render, screen } from '@testing-library/react'
import { AppPlaceholder } from './main'

test('affiche le nom de l’app', () => {
  render(<AppPlaceholder />)
  expect(screen.getByText('Runes de Chêne V2')).toBeInTheDocument()
})
