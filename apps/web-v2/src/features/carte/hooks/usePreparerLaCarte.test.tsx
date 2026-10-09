/**
 * QUOI     — la carte se prépare pendant qu'on regarde l'Accueil : ses lieux sont demandés après
 *            un court moment, pas tout de suite, et une seule fois.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { usePreparerLaCarte } from './usePreparerLaCarte'

const api = vi.hoisted(() => ({ fetchCarteLieux: vi.fn(() => Promise.resolve([])) }))
vi.mock('../api/carte', () => api)

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

function monter(client: QueryClient) {
  return renderHook(usePreparerLaCarte, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
}

test('les lieux de la carte sont demandés après deux secondes, pas avant', async () => {
  const client = new QueryClient()
  monter(client)
  await act(() => vi.advanceTimersByTimeAsync(1500))
  expect(api.fetchCarteLieux).not.toHaveBeenCalled()
  await act(() => vi.advanceTimersByTimeAsync(600))
  expect(api.fetchCarteLieux).toHaveBeenCalledTimes(1)
  expect(client.getQueryData(['carte', 'lieux'])).toEqual([])
})

test('quitter avant le moment venu ne demande rien', async () => {
  api.fetchCarteLieux.mockClear()
  const { unmount } = monter(new QueryClient())
  unmount()
  await act(() => vi.advanceTimersByTimeAsync(3000))
  expect(api.fetchCarteLieux).not.toHaveBeenCalled()
})
