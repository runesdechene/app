/**
 * QUOI     — une visite réussie relit la fiche, la carte et les profils (l'onglet Compte).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, test, vi } from 'vitest'
import { useVisite } from './useVisite'

const api = vi.hoisted(() => ({
  visiterLieu: vi.fn(() => Promise.resolve('2026-09-28T10:00:00Z')),
}))
vi.mock('../api/lieu', () => api)

test('une visite réussie relit aussi les profils', async () => {
  const client = new QueryClient()
  const relire = vi.spyOn(client, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useVisite('a'), { wrapper })
  await act(() => result.current.visiter({ lat: 45, lng: 6 }))
  expect(relire).toHaveBeenCalledWith({ queryKey: ['explorateur'] })
})
