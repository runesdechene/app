/**
 * QUOI     — la découverte, en deux genres (maquettes du 02/11 et du 03/11) : un nouveau Fragment (la
 *            carte qui se retourne, sa place dans sa collection, sa première anecdote) ; une nouvelle
 *            anecdote (le compte des anecdotes trouvées, « Creuser encore » qui reste, les
 *            félicitations quand tout est trouvé).
 * POURQUOI — chaque anecdote gagnée a son moment, et le premier scan donne envie de scanner les autres.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import type { Tirage } from '../api/lireTirage'
import { DecouverteFragment } from './DecouverteFragment'

const premierScan: Tirage = {
  anecdote: { texte: 'Celle qui choisit les morts.', rarete: 'peu_commune' },
  raison: 'gratuite',
  restantes: 4,
  raresRestantes: 1,
  premiereDecouverte: true,
  collection: { nom: 'La Garde d’Acier', connus: 2, total: 5 },
}

const duJour: Tirage = {
  ...premierScan,
  anecdote: { texte: 'Elles servent l’hydromel.', rarete: 'commune' },
  restantes: 17,
  premiereDecouverte: false,
}

function afficher(tirage: Tirage, props: Partial<Parameters<typeof DecouverteFragment>[0]> = {}) {
  const fermer = vi.fn()
  const creuser = vi.fn()
  render(
    <MemoryRouter>
      <DecouverteFragment
        nom="Valkyrie"
        illustration={null}
        tirage={tirage}
        total={20}
        boutique="https://runesdechene.com/collections/valkyrie"
        creuser={creuser}
        enCours={false}
        plusDEnergie={false}
        fermer={fermer}
        {...props}
      />
    </MemoryRouter>,
  )
  return { fermer, creuser }
}

test('un nouveau Fragment : le titre, le nom, sa place dans sa collection', () => {
  afficher(premierScan)
  expect(screen.getByRole('dialog', { name: 'Nouveau Fragment !' })).toBeInTheDocument()
  expect(screen.getByText('Valkyrie')).toBeInTheDocument()
  expect(screen.getByText('2 sur 5 de La Garde d’Acier')).toBeInTheDocument()
  expect(screen.getByText('· ta première anecdote')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Voir dans le Codex/ })).toHaveAttribute('href', '/codex')
})

test('une nouvelle anecdote : le compte des anecdotes, pas la collection', () => {
  afficher(duJour)
  expect(screen.getByRole('dialog', { name: 'Nouvelle anecdote !' })).toBeInTheDocument()
  expect(screen.getByText('Elles servent l’hydromel.')).toBeInTheDocument()
  expect(screen.getByText('3 sur 20 anecdotes trouvées')).toBeInTheDocument()
  expect(screen.getByText('· ton anecdote du jour')).toBeInTheDocument()
  expect(screen.queryByText(/de La Garde d’Acier/)).toBeNull()
})

test('creuser après le premier scan révèle une anecdote, pas un second Fragment', () => {
  afficher({ ...premierScan, raison: 'creusee', anecdote: { texte: 'Douze.', rarete: 'rare' } })
  expect(screen.getByRole('dialog', { name: 'Anecdote rare !' })).toBeInTheDocument()
  expect(screen.getByText('· trouvée en creusant')).toBeInTheDocument()
})

test('« Creuser encore » creuse sans fermer ; « Voir sa fiche » ferme', async () => {
  const { creuser, fermer } = afficher(duJour)
  await userEvent.click(screen.getByRole('button', { name: /Creuser encore/ }))
  expect(creuser).toHaveBeenCalled()
  expect(fermer).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: /Voir sa fiche/ }))
  expect(fermer).toHaveBeenCalled()
})

test('plus d’énergie : le bouton le dit et ne creuse pas', () => {
  afficher(duJour, { plusDEnergie: true })
  expect(screen.getByRole('button', { name: /Plus assez d’énergie/ })).toBeDisabled()
})

test('la dernière anecdote : des félicitations à la place de « Creuser encore »', () => {
  afficher({ ...duJour, restantes: 0 })
  expect(
    screen.getByText('Félicitations, tu as découvert toutes ses anecdotes !'),
  ).toBeInTheDocument()
  expect(screen.getByText('· ta dernière anecdote')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Creuser encore/ })).toBeNull()
})
