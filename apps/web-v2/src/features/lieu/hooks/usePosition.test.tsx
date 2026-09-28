import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { usePosition } from './usePosition'

afterEach(() => {
  vi.unstubAllGlobals()
})

function geoloc(
  etat: 'granted' | 'denied' | 'prompt',
  watch: (ok: (p: GeolocationPosition) => void, ko: (e: { code: number }) => void) => void,
) {
  vi.stubGlobal('navigator', {
    permissions: { query: () => Promise.resolve({ state: etat, addEventListener: () => {} }) },
    geolocation: {
      watchPosition: (ok: never, ko: never) => {
        watch(ok, ko)
        return 1
      },
      clearWatch: () => {},
    },
  })
}

test('position autorisée : elle suit le téléphone', async () => {
  geoloc('granted', (ok) => {
    ok({ coords: { latitude: 45, longitude: 6 } } as GeolocationPosition)
  })
  const { result } = renderHook(() => usePosition())
  await act(() => Promise.resolve())
  expect(result.current.position).toEqual({ lat: 45, lng: 6 })
})

test('jamais demandée : « inconnue » ; la demander puis refuser : « refusee »', async () => {
  geoloc('prompt', (_ok, ko) => {
    ko({ code: 1 })
  })
  const { result } = renderHook(() => usePosition())
  await act(() => Promise.resolve())
  expect(result.current.position).toBe('inconnue')
  act(() => {
    result.current.demander()
  })
  expect(result.current.position).toBe('refusee')
})

test('sans géolocalisation : « refusee », jamais une erreur', async () => {
  vi.stubGlobal('navigator', {})
  const { result } = renderHook(() => usePosition())
  await act(() => Promise.resolve())
  expect(result.current.position).toBe('refusee')
})

test('une position lente ou introuvable n’est pas un refus', async () => {
  geoloc('granted', (_ok, ko) => {
    ko({ code: 3 })
  })
  const { result } = renderHook(() => usePosition())
  await act(() => Promise.resolve())
  expect(result.current.position).toBe('inconnue')
})
