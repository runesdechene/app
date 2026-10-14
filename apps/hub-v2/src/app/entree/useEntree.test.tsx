import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import { CLE_ENTREE, useEntree } from './useEntree'

const { lire } = vi.hoisted(() => ({ lire: vi.fn() }))
vi.mock('./entree', () => ({ lireEntree: lire }))
vi.mock('@/shared/supabase/client', () => ({
  supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }) } },
}))

const client = new QueryClient()
const enveloppe = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
)

test('une relecture qui échoue ne retire pas l’entrée déjà connue', async () => {
  lire.mockResolvedValueOnce({ session: true, admin: true })
  lire.mockRejectedValueOnce(new Error('réseau'))
  const { result } = renderHook(() => useEntree(), { wrapper: enveloppe })
  await waitFor(() => { expect(result.current.etat.statut).toBe('pret') })
  act(() => { result.current.relire() })
  await waitFor(() => { expect(client.getQueryState(CLE_ENTREE)?.status).toBe('error') })
  expect(result.current.etat).toEqual({ statut: 'pret', session: true, admin: true })
})
