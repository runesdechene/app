/**
 * QUOI     — la pastille de choix : en lecture un simple texte, cliquable elle dit si elle est choisie.
 */
import { render, screen } from '@testing-library/react'
import { PastilleChoix } from './PastilleChoix'

test('sans action : un simple texte', () => {
  render(<PastilleChoix libelle="Hoplite" />)
  expect(screen.queryByRole('button')).toBeNull()
  expect(screen.getByText('Hoplite')).toBeInTheDocument()
})

test('avec action : un bouton qui dit s’il est choisi', () => {
  render(<PastilleChoix libelle="Hoplite" choisie onClick={() => undefined} />)
  expect(screen.getByRole('button', { name: /Hoplite/ })).toHaveAttribute('aria-pressed', 'true')
})

test('une marque (✦) précède le libellé, décorative pour les lecteurs d’écran', () => {
  render(<PastilleChoix libelle="Pèlerin" marque="✦" />)
  const marque = screen.getByText('✦')
  expect(marque).toHaveAttribute('aria-hidden', 'true')
})
