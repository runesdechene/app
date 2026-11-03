/**
 * QUOI     — le récit d'un Fragment : au Porteur, l'histoire entière et rien à acheter ; ailleurs (la
 *            vitrine), le début, « Lire tout le récit » et « Acheter ce Fragment ». Plus d'onglet
 *            « Ses énigmes » (Uriel, 03/11).
 */
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import type { Recit } from '../api/lireRecit'
import { RecitFragment } from './RecitFragment'

const druide: Recit = {
  id: 9,
  nom: 'Druide',
  heritage: 'Les mystères celtes',
  illustration: null,
  resume: null,
  histoire: 'Premier temps.\n\nDeuxième temps.\n\nTroisième temps.',
  audio: null,
  narrateur: null,
  origine: null,
  boutique: 'https://runesdechene.com/collections/druide',
  artiste: null,
  artistePhoto: null,
  motArtiste: null,
  edition: null,
  editionPrecision: null,
}
vi.mock('../hooks/useRecit', () => ({
  useRecit: () => ({ recit: druide, erreur: false, reessayer: vi.fn() }),
}))

test('au Porteur : l’histoire entière, rien à acheter, pas d’énigmes', () => {
  render(<RecitFragment id={9} porteur />)
  expect(screen.getByText('Troisième temps.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Lire tout le récit' })).toBeNull()
  expect(screen.queryByText(/Acheter/)).toBeNull()
  expect(screen.queryByText('Ses énigmes')).toBeNull()
})

test('ailleurs : le début, « Lire tout le récit », et « Acheter ce Fragment »', () => {
  render(<RecitFragment id={9} />)
  expect(screen.queryByText('Troisième temps.')).toBeNull()
  expect(screen.getByRole('button', { name: 'Lire tout le récit' })).toBeInTheDocument()
  expect(screen.getByText('Acheter ce Fragment')).toBeInTheDocument()
})
