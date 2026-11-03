/**
 * QUOI     — « Ses anecdotes » : celles trouvées, la nouvelle après un scan, « Creuser encore » (2
 *            énergies), ou « Scanner ce motif » depuis le Codex.
 * POURQUOI — spec du Codex (02/11) : « Creuser encore » n'existe qu'après un scan ; faute d'énergie,
 *            le bouton le dit ; toutes trouvées, il disparaît.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import type { Tirage } from '../api/lireTirage'
import { Anecdotes } from './Anecdotes'

const trouvees = [{ texte: 'Elle va souvent par trois.', rarete: 'commune' as const }]

function afficher(props: Partial<Parameters<typeof Anecdotes>[0]> = {}) {
  const creuser = vi.fn()
  render(
    <MemoryRouter>
      <Anecdotes
        anecdotes={trouvees}
        restantes={6}
        raresRestantes={1}
        tirage={null}
        creuser={creuser}
        enCours={false}
        plusDEnergie={false}
        echec={false}
        {...props}
      />
    </MemoryRouter>,
  )
  return creuser
}

const tirage = (t: Partial<Tirage>): Tirage => ({
  anecdote: { texte: 'Les Irlandais la voyaient en corneille.', rarete: 'rare' },
  raison: 'gratuite',
  restantes: 5,
  raresRestantes: 0,
  premiereDecouverte: false,
  collection: null,
  ...t,
})

test('depuis le Codex : les trouvées, ce qui reste, « Scanner ce motif », jamais « Creuser »', () => {
  afficher()
  expect(screen.getByText('Elle va souvent par trois.')).toBeInTheDocument()
  expect(screen.getByText(/6 anecdotes à découvrir, dont 1 rare/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Scanner ce motif/ })).toHaveAttribute('href', '/scan')
  expect(screen.queryByRole('button', { name: /Creuser encore/ })).toBeNull()
})

test('après un scan : la nouvelle anecdote, son insigne, et « Creuser encore » pour 2', async () => {
  const creuser = afficher({ tirage: tirage({}) })
  expect(screen.getByText('Les Irlandais la voyaient en corneille.')).toBeInTheDocument()
  expect(screen.getAllByRole('img', { name: 'Rare' }).length).toBeGreaterThan(0)
  const bouton = screen.getByRole('button', { name: /Creuser encore/ })
  expect(bouton).toHaveTextContent('2')
  await userEvent.click(bouton)
  expect(creuser).toHaveBeenCalled()
})

test('déjà l’anecdote du jour : on peut encore creuser', () => {
  afficher({ tirage: tirage({ anecdote: null, raison: 'deja_aujourdhui' }) })
  expect(screen.getByText(/Ton anecdote gratuite du jour est déjà trouvée/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Creuser encore/ })).toBeEnabled()
})

test('plus assez d’énergie : le bouton le dit et se grise', () => {
  afficher({ tirage: tirage({}), plusDEnergie: true })
  expect(screen.getByRole('button', { name: /Plus assez d’énergie/ })).toBeDisabled()
})

test('toutes trouvées : plus de bouton', () => {
  afficher({
    tirage: tirage({ anecdote: null, raison: 'toutes_trouvees', restantes: 0 }),
    restantes: 0,
  })
  expect(screen.getByText('Félicitations, tu as découvert toutes ses anecdotes !')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Creuser encore/ })).toBeNull()
})
