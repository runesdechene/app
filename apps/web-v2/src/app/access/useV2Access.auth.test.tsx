/**
 * QUOI     — un changement de session (déconnexion dans un onglet V1) refait la vérification ;
 *            un e-mail changé est recopié et les autres sessions fermées (comme la V1).
 * POURQUOI — sans cela, un onglet V2 resté ouvert survivrait à une déconnexion (relecture 27/09).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import { useV2Access } from './useV2Access'

// La session simulée, et le rappel que Supabase appelle à chaque changement de session.
const session = vi.hoisted(() => {
  const state: {
    current: object | null
    onChange: (event: string, session?: { user: { id: string; email?: string } }) => void
  } = {
    current: { user: { id: 'u1' } },
    onChange: () => undefined,
  }
  return state
})

const ecritures = vi.hoisted(() => ({
  update: vi.fn<(valeurs: object, id: string) => Promise<{ error: null }>>(() =>
    Promise.resolve({ error: null }),
  ),
  signOut: vi.fn<(options: object) => Promise<{ error: null }>>(() =>
    Promise.resolve({ error: null }),
  ),
}))

vi.mock('@/shared/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: session.current }, error: null }),
      signOut: ecritures.signOut,
      onAuthStateChange: (callback: typeof session.onChange) => {
        session.onChange = callback
        return { data: { subscription: { unsubscribe: () => undefined } } }
      },
    },
    rpc: () => Promise.resolve({ data: true, error: null }),
    from: () => ({
      update: (valeurs: object) => ({
        eq: (_c: string, id: string) => ecritures.update(valeurs, id),
      }),
    }),
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

test('un e-mail changé est recopié, et les autres sessions fermées', async () => {
  session.current = { user: { id: 'u1' } }
  renderHook(() => useV2Access(), { wrapper })
  session.onChange('USER_UPDATED', { user: { id: 'u1', email: 'nouveau@exemple.fr' } })
  await waitFor(() => {
    expect(ecritures.update).toHaveBeenCalledWith({ email_address: 'nouveau@exemple.fr' }, 'u1')
  })
  await waitFor(() => {
    expect(ecritures.signOut).toHaveBeenCalledWith({ scope: 'others' })
  })
})
