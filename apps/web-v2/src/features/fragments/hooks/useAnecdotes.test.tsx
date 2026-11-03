/**
 * QUOI     — un scan tire une anecdote, une seule fois : l'heure du scan quitte l'historique, et la
 *            fiche rouverte (retour, rechargement) ne tire plus rien.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import { expect, test, vi } from 'vitest'
import { lireArrivee } from '../lib/arrivee'
import { useAnecdotes } from './useAnecdotes'

const api = vi.hoisted(() => ({ tirerAnecdote: vi.fn(), PasAssezDEnergie: class extends Error {} }))
vi.mock('../api/anecdote', () => api)

const TIRAGE = {
  anecdote: { texte: 'Celle qui choisit les morts.', rarete: 'commune' },
  raison: 'gratuite',
  restantes: 2,
  raresRestantes: 0,
  premiereDecouverte: true,
  collection: null,
}

function monter(etat: unknown) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[{ pathname: '/codex/fragment/3', state: etat }]}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  )
  return renderHook(
    () => {
      const location = useLocation()
      const recu: unknown = location.state
      return { anecdotes: useAnecdotes(3, lireArrivee(recu)), etat: recu }
    },
    { wrapper },
  )
}

test('ouverte par un scan : un tirage gratuit, et l’heure du scan quitte l’historique', async () => {
  api.tirerAnecdote.mockResolvedValue(TIRAGE)
  const { result } = monter({ scan: 1000 })
  await waitFor(() => {
    expect(result.current.anecdotes.tirage).toEqual(TIRAGE)
  })
  expect(result.current.etat).toBeNull()
  expect(api.tirerAnecdote).toHaveBeenCalledTimes(1)
  expect(api.tirerAnecdote).toHaveBeenCalledWith(3, false)
})

test('rouverte sans scan (retour, rechargement) : rien n’est tiré', () => {
  api.tirerAnecdote.mockClear()
  const { result } = monter(null)
  expect(result.current.anecdotes.tirage).toBeNull()
  expect(api.tirerAnecdote).not.toHaveBeenCalled()
})

test('le rescan a choisi de creuser : le tirage creuse', async () => {
  api.tirerAnecdote.mockClear()
  api.tirerAnecdote.mockResolvedValue({ ...TIRAGE, raison: 'creusee' })
  const { result } = monter({ scan: 2000, creuser: true })
  await waitFor(() => {
    expect(result.current.anecdotes.tirage?.raison).toBe('creusee')
  })
  expect(api.tirerAnecdote).toHaveBeenCalledWith(3, true)
})
