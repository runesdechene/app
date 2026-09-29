/**
 * QUOI     — la vérification d'accès abandonne au bout d'un délai et passe en « erreur ».
 * POURQUOI — hors connexion, supabase-js peut réessayer pendant des dizaines de secondes ; sans
 *            délai, un testeur fixerait un écran vide (relecture du 27/09).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import { ACCESS_TIMEOUT_MS, useV2Access } from './useV2Access'

vi.mock('@/shared/supabase/client', () => ({
  supabase: {
    // Un réseau qui ne répond jamais.
    auth: {
      getSession: () => new Promise(() => undefined),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
    },
    rpc: () => new Promise(() => undefined),
  },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

afterEach(() => {
  vi.useRealTimers()
})

test('réseau muet : chargement, puis erreur une fois le délai écoulé', async () => {
  vi.useFakeTimers()
  const { result } = renderHook(() => useV2Access(), { wrapper })
  expect(result.current.state.status).toBe('loading')

  await act(async () => {
    await vi.advanceTimersByTimeAsync(ACCESS_TIMEOUT_MS + 1)
  })

  expect(result.current.state.status).toBe('error')
})
