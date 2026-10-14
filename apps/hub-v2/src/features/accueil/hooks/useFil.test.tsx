import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import { PAGE, type Activite } from '../api/fil'
import { useFil } from './useFil'

const { lire } = vi.hoisted(() => ({ lire: vi.fn() }))
vi.mock('../api/fil', async (original) => ({ ...(await original<typeof import('../api/fil')>()), lireFil: lire }))

function ligne(i: number): Activite {
  return { type: 'lieu', sorte: 'ajout', cle: `k${String(i)}`, quand: new Date(Date.UTC(2026, 9, 14, 12, 0, 0) - i * 60_000).toISOString(), qui: null, lieu: null, donnees: {} }
}

const enveloppe = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)

test('« Voir tout le fil » disparaît quand une page revient incomplète', async () => {
  lire.mockResolvedValueOnce(Array.from({ length: PAGE }, (_, i) => ligne(i)))
  lire.mockResolvedValueOnce([ligne(100)])
  const { result } = renderHook(() => useFil([]), { wrapper: enveloppe })
  await waitFor(() => { expect(result.current.activites).toHaveLength(PAGE) })
  expect(result.current.aDAutres).toBe(true)
  act(() => { result.current.voirPlus() })
  await waitFor(() => { expect(result.current.activites).toHaveLength(PAGE + 1) })
  expect(result.current.aDAutres).toBe(false)
  expect(lire).toHaveBeenLastCalledWith([], ligne(PAGE - 1).quand)
})

test('une ligne reprise à la frontière de deux pages ne s’affiche qu’une fois', async () => {
  lire.mockReset()
  lire.mockResolvedValueOnce(Array.from({ length: PAGE }, (_, i) => ligne(i)))
  lire.mockResolvedValueOnce([ligne(PAGE - 1), ligne(PAGE)])
  const { result } = renderHook(() => useFil([]), { wrapper: enveloppe })
  await waitFor(() => { expect(result.current.activites).toHaveLength(PAGE) })
  act(() => { result.current.voirPlus() })
  await waitFor(() => { expect(result.current.activites).toHaveLength(PAGE + 1) })
  expect(new Set(result.current.activites.map((a) => a.cle)).size).toBe(PAGE + 1)
})
