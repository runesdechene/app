/**
 * QUOI     — l'avatar : la photo si elle existe, sinon l'initiale ; deux tailles.
 */
import { render, screen } from '@testing-library/react'
import { Avatar } from './Avatar'

test('avec une photo : une image nommée', () => {
  render(<Avatar url="https://exemple.fr/a.webp" nom="Uriel" taille="grand" />)
  expect(screen.getByRole('img', { name: 'Uriel' })).toHaveAttribute(
    'src',
    'https://exemple.fr/a.webp',
  )
})

test('sans photo : l’initiale en majuscule', () => {
  render(<Avatar url={null} nom="claire" taille="petit" />)
  expect(screen.getByRole('img', { name: 'claire' })).toHaveTextContent('C')
})

test('la taille se lit dans la classe', () => {
  render(<Avatar url={null} nom="Claire" taille="grand" />)
  expect(screen.getByRole('img', { name: 'Claire' }).className).toMatch(/grand/)
})
