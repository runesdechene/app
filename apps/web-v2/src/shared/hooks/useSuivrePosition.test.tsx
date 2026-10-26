/**
 * QUOI     — le suivi de position de l'app : il démarre sans attendre l'autorisation (Safari sur
 *            iPhone répond « à demander » même accordée), suit le téléphone, et ce que les
 *            boutons de visite en lisent (`usePosition`).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { usePosition } from './usePosition'
import { useSuivrePosition } from './useSuivrePosition'

type Ok = (p: { coords: { latitude: number; longitude: number } }) => void
type Ko = (e: { code: number }) => void

// Un navigateur qui répond `etat` à l'autorisation ; `suivis` garde chaque suivi lancé.
function navigateur(etat: PermissionState) {
  const suivis: { ok: Ok; ko: Ko }[] = []
  vi.stubGlobal('navigator', {
    permissions: {
      query: () =>
        Promise.resolve({ state: etat, addEventListener: () => {}, removeEventListener: () => {} }),
    },
    geolocation: {
      watchPosition: (ok: Ok, ko: Ko) => suivis.push({ ok, ko }),
      clearWatch: () => {},
      getCurrentPosition: (ok: Ok) => {
        ok({ coords: { latitude: 47, longitude: 2 } })
      },
    },
  })
  return suivis
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function monter() {
  return renderHook(
    () => {
      useSuivrePosition()
      return usePosition()
    },
    { wrapper },
  )
}

test('Safari dit « à demander » : le suivi part quand même, et suit le téléphone', async () => {
  const suivis = navigateur('prompt')
  const { result } = monter()
  expect(suivis).toHaveLength(1)
  act(() => {
    suivis[0]?.ok({ coords: { latitude: 45, longitude: 6 } })
  })
  await waitFor(() => {
    expect(result.current.position).toEqual({ lat: 45, lng: 6 })
  })
  act(() => {
    suivis[0]?.ok({ coords: { latitude: 45.001, longitude: 6 } })
  })
  await waitFor(() => {
    expect(result.current.position).toEqual({ lat: 45.001, lng: 6 })
  })
})

test('une position lente ou introuvable n’est pas un refus', async () => {
  const suivis = navigateur('granted')
  const { result } = monter()
  act(() => {
    suivis[0]?.ko({ code: 3 })
  })
  await act(() => Promise.resolve())
  expect(result.current.position).toBe('inconnue')
})

test('refusée, puis « Me localiser » accordé : la position revient et le suivi repart', async () => {
  const suivis = navigateur('prompt')
  const { result } = monter()
  act(() => {
    suivis[0]?.ko({ code: 1 })
  })
  await waitFor(() => {
    expect(result.current.position).toBe('refusee')
  })
  act(() => {
    result.current.demander()
  })
  await waitFor(() => {
    expect(result.current.position).toEqual({ lat: 47, lng: 2 })
  })
  expect(suivis).toHaveLength(2)
})

test('sans géolocalisation : « refusee », jamais une erreur', async () => {
  vi.stubGlobal('navigator', {})
  const { result } = monter()
  await act(() => Promise.resolve())
  expect(result.current.position).toBe('refusee')
})
