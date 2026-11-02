/**
 * QUOI     — les trois insignes de rareté (anecdotes, rang du numéro de Porteur).
 * POURQUOI — un seul jeu d'insignes pour tout le Codex (spec 02/11, Figma « Codex V1 / Rareté »).
 */
import { render, screen } from '@testing-library/react'
import { Insigne } from './Insigne'

test('l’insigne seul se lit par son nom', () => {
  render(<Insigne rarete="rare" />)
  expect(screen.getByRole('img', { name: 'Rare' })).toBeInTheDocument()
})

test('avec son libellé, en capitales', () => {
  render(<Insigne rarete="peu_commune" avecLibelle />)
  expect(screen.getByText('PEU COMMUNE')).toBeInTheDocument()
})
