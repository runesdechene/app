/**
 * QUOI     — la page « Nouveautés » : la dernière en entier, les précédentes dessous.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { Nouveautes } from './Nouveautes'

const api = vi.hoisted(() => ({ fetchMisesAJour: vi.fn() }))
vi.mock('../api/nouveautes', () => api)

beforeEach(() => {
  api.fetchMisesAJour.mockResolvedValue([
    {
      id: 2,
      titre: 'Filtrer la carte',
      texte: 'Un seul bouton.\n\n- Par nature : plusieurs à la fois.',
      quand: '2026-09-30T10:00:00Z',
    },
    {
      id: 1,
      titre: 'Ajouter à distance',
      texte: 'Plus besoin d’y être.',
      quand: '2026-09-28T10:00:00Z',
    },
  ])
})

function afficher() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Nouveautes />
    </QueryClientProvider>,
  )
}

test('la dernière en entier, sa liste mise en forme ; les précédentes dessous', async () => {
  afficher()
  expect(await screen.findByRole('heading', { name: 'Filtrer la carte' })).toBeInTheDocument()
  expect(screen.getByText('30 septembre')).toBeInTheDocument()
  expect(screen.getByText('Un seul bouton.')).toBeInTheDocument()
  expect(screen.getByText('Par nature').tagName).toBe('STRONG')
  const precedentes = screen.getByRole('region', { name: 'Précédentes' })
  expect(
    within(precedentes).getByRole('heading', { name: 'Ajouter à distance' }),
  ).toBeInTheDocument()
})

test('aucune mise à jour : on le dit', async () => {
  api.fetchMisesAJour.mockResolvedValue([])
  afficher()
  expect(await screen.findByText('Pas encore de nouveautés')).toBeInTheDocument()
})
