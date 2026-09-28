/**
 * QUOI     — saluer colore la feuille tout de suite ; un refus de la base la remet comme avant.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, test, vi } from 'vitest'
import { useSaluer } from './useSaluer'

const api = vi.hoisted(() => ({ saluer: vi.fn() }))
vi.mock('../api/accueil', () => api)

const LIGNE = { id: 'visite:l1:u1', saluts: 2, salue: false }

function monter() {
  const client = new QueryClient()
  client.setQueryData(['accueil', 'chemins'], [LIGNE])
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useSaluer(), { wrapper })
  return { client, saluer: result.current }
}

test('saluer compte le salut tout de suite, puis garde la réponse de la base', async () => {
  let repondre: (v: { saluts: number; salue: boolean }) => void = () => undefined
  api.saluer.mockReturnValue(new Promise((r) => (repondre = r)))
  const { client, saluer } = monter()
  act(() => {
    saluer(LIGNE.id)
  })
  await waitFor(() => {
    expect(client.getQueryData(['accueil', 'chemins'])).toEqual([
      { ...LIGNE, saluts: 3, salue: true },
    ])
  })
  act(() => {
    repondre({ saluts: 5, salue: true })
  })
  await waitFor(() => {
    expect(client.getQueryData(['accueil', 'chemins'])).toEqual([
      { ...LIGNE, saluts: 5, salue: true },
    ])
  })
})

test('un refus de la base remet la ligne comme avant', async () => {
  api.saluer.mockRejectedValue(new Error('refus'))
  const { client, saluer } = monter()
  act(() => {
    saluer(LIGNE.id)
  })
  await waitFor(() => {
    expect(client.getQueryData(['accueil', 'chemins'])).toEqual([LIGNE])
  })
})
