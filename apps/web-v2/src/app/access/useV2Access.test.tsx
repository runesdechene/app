/**
 * QUOI     — la vérification d'accès abandonne au bout d'un délai et passe en « erreur ».
 * POURQUOI — hors connexion, supabase-js peut réessayer pendant des dizaines de secondes ; sans
 *            délai, un testeur fixerait un écran vide (relecture du 27/09).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import { ACCESS_TIMEOUT_MS, useV2Access } from './useV2Access'

// Par défaut, un réseau qui ne répond jamais ; un test peut le piloter.
const rpcReponse = vi.hoisted(() => vi.fn(() => new Promise(() => undefined)))
const sessionReponse = vi.hoisted(() => vi.fn(() => new Promise(() => undefined)))
vi.mock('@/shared/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: sessionReponse,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
    },
    rpc: rpcReponse,
  },
}))

beforeEach(() => {
  rpcReponse.mockReset()
  rpcReponse.mockImplementation(() => new Promise(() => undefined))
  sessionReponse.mockReset()
  sessionReponse.mockImplementation(() => new Promise(() => undefined))
})

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

test('hors ligne, avec l’accès gardé : la V2 s’ouvre quand même', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['v2-access'], { hasSession: true, hasAccess: true })
  sessionReponse.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null })
  rpcReponse.mockRejectedValue(new TypeError('Failed to fetch'))
  const { result } = renderHook(() => useV2Access(), {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  })
  // La copie est relue en ligne ; ici la relecture échoue, et la copie fait foi.
  await waitFor(() => {
    expect(rpcReponse).toHaveBeenCalled()
  })
  await waitFor(() => {
    expect(result.current.state).toEqual({ status: 'ready', hasSession: true, hasAccess: true })
  })
})
