/**
 * QUOI     — un changement de session (déconnexion dans un onglet V1) refait la vérification.
 * POURQUOI — sans cela, un onglet V2 resté ouvert survivrait à une déconnexion (relecture 27/09).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import { useV2Access } from './useV2Access'

// La session simulée, et le rappel que Supabase appelle à chaque changement de session.
const session = vi.hoisted(() => {
  const state: { current: object | null; onChange: (event: string) => void } = {
    current: { user: { id: 'u1' } },
    onChange: () => undefined,
  }
  return state
})

vi.mock('@/shared/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: session.current }, error: null }),
      onAuthStateChange: (callback: (event: string) => void) => {
        session.onChange = callback
        return { data: { subscription: { unsubscribe: () => undefined } } }
      },
    },
    rpc: () => Promise.resolve({ data: true, error: null }),
  },
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  // Fragment : voir useV2Access.test.tsx (types React 18 hissés par la V1).
  return (
    <QueryClientProvider client={client}>
      <>{children}</>
    </QueryClientProvider>
  )
}

test('une déconnexion ailleurs referme la porte', async () => {
  const { result } = renderHook(() => useV2Access(), { wrapper })
  await waitFor(() => {
    expect(result.current.state).toEqual({ status: 'ready', hasSession: true, hasAccess: true })
  })

  session.current = null
  session.onChange('SIGNED_OUT')

  await waitFor(() => {
    expect(result.current.state).toEqual({ status: 'ready', hasSession: false, hasAccess: false })
  })
})
