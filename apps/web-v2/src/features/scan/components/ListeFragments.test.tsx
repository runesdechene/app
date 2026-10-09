/**
 * QUOI     — « Voir tous les Fragments » : chaque Fragment visible mène à son Récit.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test, vi } from 'vitest'

const liste = vi.hoisted(() => ({
  fragments: [{ id: 11, nom: 'Hoplite', illustration: 'https://cdn.shopify.com/h.png' }] as
    { id: number; nom: string; illustration: string | null }[] | undefined,
  erreur: false,
}))
vi.mock('../hooks/useEmpreintes', () => ({ useFragmentsVisibles: () => liste }))

import { ListeFragments } from './ListeFragments'

test('chaque Fragment mène à son Récit', () => {
  render(
    <MemoryRouter>
      <ListeFragments connecte={false} />
    </MemoryRouter>,
  )
  expect(screen.getByRole('link', { name: /Hoplite/ })).toHaveAttribute('href', '/scan/fragment/11')
})

test('la liste qui ne se charge pas (hors réseau) le dit', () => {
  liste.fragments = undefined
  liste.erreur = true
  render(
    <MemoryRouter>
      <ListeFragments connecte={false} />
    </MemoryRouter>,
  )
  expect(
    screen.getByText('La liste n’a pas pu se charger. Vérifie ta connexion.'),
  ).toBeInTheDocument()
})
