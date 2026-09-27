/**
 * QUOI     — aucune brique de shared/ui/ ne peut exister hors de la page de DA.
 * POURQUOI — « pas d'élément sauvage » (décision 007) : une brique ajoutée sans être montrée
 *            fait échouer ce test ; un jeton de couleur ou un style de texte aussi.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { TEXT_VARIANTS } from '@/shared/ui/textVariants'
import { DaPage } from './DaPage'
import { COLOR_TOKENS, DA_SHOWCASED } from './daTokens'

// La page montre la vraie barre d'onglets, qui a besoin d'un routeur.
function renderPage() {
  render(
    <MemoryRouter initialEntries={['/da']}>
      <DaPage />
    </MemoryRouter>,
  )
}

const briques = Object.keys(import.meta.glob('../../shared/ui/*.tsx'))
  .filter((file) => !file.endsWith('.test.tsx'))
  .map((file) => (file.split('/').pop() ?? '').replace('.tsx', ''))

test('chaque brique de shared/ui est montrée', () => {
  expect([...DA_SHOWCASED].sort()).toEqual(briques.sort())
})

test('chaque brique a sa section', () => {
  renderPage()
  for (const nom of briques) {
    expect(screen.getByRole('region', { name: nom })).toBeInTheDocument()
  }
})

test('chaque couleur est montrée avec son nom', () => {
  renderPage()
  for (const couleur of COLOR_TOKENS) {
    expect(screen.getByText(couleur)).toBeInTheDocument()
  }
})

test('chaque style de texte est montré avec son nom', () => {
  renderPage()
  for (const variant of TEXT_VARIANTS) {
    expect(screen.getByText(variant)).toBeInTheDocument()
  }
})
