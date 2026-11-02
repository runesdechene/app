/**
 * QUOI     — la découverte d'un nouveau Fragment (maquette « Scan — un nouveau Fragment sort de
 *            l'ombre », 02/11) : la carte qui se retourne, le titre, sa place dans sa collection, la
 *            première anecdote, et les gestes qui suivent.
 * POURQUOI — le premier scan d'un motif est le moment qui donne envie de scanner les autres.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import { DecouverteFragment } from './DecouverteFragment'

function afficher(props: Partial<Parameters<typeof DecouverteFragment>[0]> = {}) {
  const fermer = vi.fn()
  const creuser = vi.fn()
  render(
    <MemoryRouter>
      <DecouverteFragment
        nom="Valkyrie"
        illustration={null}
        collection={{ nom: 'La Garde d’Acier', connus: 2, total: 5 }}
        anecdote={{ texte: 'Celle qui choisit les morts.', rarete: 'peu_commune' }}
        boutique="https://runesdechene.com/collections/valkyrie"
        creuser={creuser}
        fermer={fermer}
        {...props}
      />
    </MemoryRouter>,
  )
  return { fermer, creuser }
}

test('le titre, le nom, sa place dans sa collection — jamais le total du Codex', () => {
  afficher()
  expect(screen.getByRole('dialog', { name: 'Nouveau Fragment !' })).toBeInTheDocument()
  expect(screen.getByText('Valkyrie')).toBeInTheDocument()
  expect(screen.getByText('2 sur 5 de La Garde d’Acier')).toBeInTheDocument()
})

test('la première anecdote et son insigne', () => {
  afficher()
  expect(screen.getByText('Celle qui choisit les morts.')).toBeInTheDocument()
  expect(screen.getAllByRole('img', { name: 'Peu commune' }).length).toBeGreaterThan(0)
})

test('« Voir dans le Codex » mène au Codex ; « Creuser encore » creuse et ferme', async () => {
  const { creuser, fermer } = afficher()
  expect(screen.getByRole('link', { name: /Voir dans le Codex/ })).toHaveAttribute('href', '/codex')
  await userEvent.click(screen.getByRole('button', { name: /Creuser encore/ }))
  expect(creuser).toHaveBeenCalled()
  expect(fermer).toHaveBeenCalled()
})

test('sans collection : pas de compte', () => {
  afficher({ collection: null })
  expect(screen.queryByText(/sur 5/)).toBeNull()
})
