/**
 * QUOI     — hors réseau à la première ouverture, les empreintes échouent pour de bon (au lieu de
 *            rester en pause) : l'écran peut dire que le scan n'a pas pu se préparer.
 */
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, test, vi } from 'vitest'

vi.mock('../api/scan', () => ({
  fetchEmpreintes: () => Promise.reject(new Error('Failed to fetch')),
  fetchFragmentsVisibles: () => Promise.reject(new Error('Failed to fetch')),
}))

import { useEmpreintes, useFragmentsVisibles } from './useEmpreintes'

afterEach(() => {
  onlineManager.setOnline(true)
})

function enveloppe({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {children}
    </QueryClientProvider>
  )
}

test('hors réseau, les empreintes et la liste sont en erreur, pas en pause', async () => {
  onlineManager.setOnline(false)
  const empreintes = renderHook(() => useEmpreintes(), { wrapper: enveloppe })
  const liste = renderHook(() => useFragmentsVisibles(), { wrapper: enveloppe })
  await waitFor(() => {
    expect(empreintes.result.current.erreur).toBe(true)
    expect(liste.result.current.erreur).toBe(true)
  })
})
