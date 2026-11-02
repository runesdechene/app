/**
 * QUOI     — les anecdotes d'un Fragment au Hub : la liste, l'ajout, la rareté, masquer.
 * POURQUOI — elles se gagnent en scannant le motif (spec du Codex, 02/11) ; seule l'équipe les écrit.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { AnecdotesDuFragment } from './AnecdotesDuFragment'

const api = vi.hoisted(() => ({ lireAnecdotes: vi.fn(), ecrireAnecdote: vi.fn() }))
vi.mock('../api/anecdotes', () => api)

function afficher() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AnecdotesDuFragment fragment={7} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  api.lireAnecdotes.mockResolvedValue([
    { id: 1, texte: 'Les Irlandais la voyaient en corneille.', rarete: 'rare', visible: true, trouvee: 4 },
  ])
  api.ecrireAnecdote.mockResolvedValue(2)
})

test('la liste dit la rareté et combien l’ont trouvée', async () => {
  afficher()
  const ligne = await screen.findByRole('listitem')
  expect(within(ligne).getByText('Les Irlandais la voyaient en corneille.')).toBeInTheDocument()
  expect(within(ligne).getByText('Rare')).toBeInTheDocument()
  expect(within(ligne).getByText('trouvée 4 fois')).toBeInTheDocument()
})

test('ajouter une anecdote commune', async () => {
  afficher()
  await screen.findByRole('listitem')
  await userEvent.type(screen.getByLabelText('Nouvelle anecdote'), 'Elle va souvent par trois')
  await userEvent.click(screen.getByRole('radio', { name: 'Commune' }))
  await userEvent.click(screen.getByRole('button', { name: 'Ajouter l’anecdote' }))
  expect(api.ecrireAnecdote).toHaveBeenCalledWith({
    id: null,
    fragment: 7,
    texte: 'Elle va souvent par trois',
    rarete: 'commune',
    visible: true,
  })
})

test('masquer une anecdote la réécrit invisible', async () => {
  afficher()
  const ligne = await screen.findByRole('listitem')
  await userEvent.click(within(ligne).getByRole('button', { name: 'Masquer' }))
  expect(api.ecrireAnecdote).toHaveBeenCalledWith({
    id: 1,
    fragment: 7,
    texte: 'Les Irlandais la voyaient en corneille.',
    rarete: 'rare',
    visible: false,
  })
})

test('une anecdote vide n’est pas envoyée', async () => {
  afficher()
  await screen.findByRole('listitem')
  await userEvent.click(screen.getByRole('button', { name: 'Ajouter l’anecdote' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Écris l’anecdote avant de l’ajouter.')
  expect(api.ecrireAnecdote).not.toHaveBeenCalled()
})
