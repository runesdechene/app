/**
 * QUOI     — « Voir tous les Fragments » : chaque Fragment visible mène à son Récit.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test, vi } from 'vitest'

vi.mock('../hooks/useEmpreintes', () => ({
  useFragmentsVisibles: () => [
    { id: 11, nom: 'Hoplite', illustration: 'https://cdn.shopify.com/h.png' },
  ],
}))

import { ListeFragments } from './ListeFragments'

test('chaque Fragment mène à son Récit', () => {
  render(
    <MemoryRouter>
      <ListeFragments connecte={false} />
    </MemoryRouter>,
  )
  expect(screen.getByRole('link', { name: /Hoplite/ })).toHaveAttribute('href', '/scan/fragment/11')
})
