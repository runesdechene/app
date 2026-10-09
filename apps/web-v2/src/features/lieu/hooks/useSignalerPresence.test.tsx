/**
 * QUOI     — la présence : signalée dès que la position est autorisée, même en cours de route —
 *            depuis les réglages du navigateur comme depuis l'invitation de l'appli.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useAutorisationPosition } from '@/shared/hooks/useAutorisationPosition'
import { useSignalerPresence } from './useSignalerPresence'

const api = vi.hoisted(() => ({ signalerPresence: vi.fn(() => Promise.resolve()) }))
vi.mock('../api/lieu', () => api)

// Un navigateur dont on règle l'autorisation ; `change` prévient qui écoute.
let statut: { state: PermissionState; ecouteurs: Set<() => void> }

beforeEach(() => {
  api.signalerPresence.mockClear()
  statut = { state: 'prompt', ecouteurs: new Set() }
  vi.stubGlobal('navigator', {
    permissions: {
      query: () =>
        Promise.resolve({
          get state() {
            return statut.state
          },
          addEventListener: (_: string, f: () => void) => statut.ecouteurs.add(f),
          removeEventListener: (_: string, f: () => void) => statut.ecouteurs.delete(f),
        }),
    },
    geolocation: {
      getCurrentPosition: (ok: (p: { coords: { latitude: number; longitude: number } }) => void) => {
        // La question du navigateur : l'Explorateur dit oui.
        statut.state = 'granted'
        ok({ coords: { latitude: 45, longitude: 6 } })
      },
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

test('autorisée dans les réglages en cours de route : la présence part aussitôt', async () => {
  renderHook(
    () => {
      useSignalerPresence()
    },
    { wrapper },
  )
  await waitFor(() => {
    expect(statut.ecouteurs.size).toBeGreaterThan(0)
  })
  expect(api.signalerPresence).not.toHaveBeenCalled()
  statut.state = 'granted'
  act(() => {
    for (const f of statut.ecouteurs) f()
  })
  await waitFor(() => {
    expect(api.signalerPresence).toHaveBeenCalledWith(45, 6)
  })
})

test('autorisée depuis l’invitation, sans que le navigateur prévienne : la présence part', async () => {
  const { result } = renderHook(
    () => {
      useSignalerPresence()
      return useAutorisationPosition()
    },
    { wrapper },
  )
  await waitFor(() => {
    expect(result.current.autorisation).toBe('a-demander')
  })
  await act(() => result.current.autoriser())
  await waitFor(() => {
    expect(api.signalerPresence).toHaveBeenCalledWith(45, 6)
  })
})
