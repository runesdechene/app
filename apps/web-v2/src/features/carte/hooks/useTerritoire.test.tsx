/**
 * QUOI     — le nom inscrit ne clignote pas quand on glisse : pendant qu'une nouvelle case se
 *            charge, l'ancien nom reste.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import { useTerritoire } from './useTerritoire'

const api = vi.hoisted(() => ({
  fetchTerritoire: vi.fn<() => Promise<{ territoire: string | null; pays: string | null }>>(),
}))
vi.mock('../api/carte', () => api)

test('en glissant d’une case à l’autre, l’ancien nom reste pendant le chargement', async () => {
  api.fetchTerritoire
    .mockResolvedValueOnce({ territoire: 'Comté de Nice', pays: 'France' })
    .mockReturnValueOnce(new Promise(() => {}))
  const client = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result, rerender } = renderHook(
    (centre: { lat: number; lng: number; zoom: number }) => useTerritoire(centre),
    { wrapper, initialProps: { lat: 43.7, lng: 7.26, zoom: 10 } },
  )
  await waitFor(() => {
    expect(result.current).toBe('Comté de Nice')
  })
  rerender({ lat: 43.75, lng: 7.3, zoom: 10 })
  expect(result.current).toBe('Comté de Nice')
})
