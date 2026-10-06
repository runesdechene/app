/**
 * QUOI     — la position suivie avec sa précision : elle s'affine tant que l'écran est ouvert.
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { usePositionPrecise } from './usePositionPrecise'

type Rappel = (p: { coords: { latitude: number; longitude: number; accuracy: number } }) => void
type Erreur = (e: { code: number }) => void
let suivre: Rappel = () => undefined
let echouer: Erreur = () => undefined

Object.defineProperty(navigator, 'geolocation', {
  configurable: true,
  value: {
    watchPosition: (ok: Rappel, ko: Erreur) => {
      suivre = ok
      echouer = ko
      return 7
    },
    clearWatch: vi.fn(),
  },
})

afterEach(() => {
  vi.clearAllMocks()
})

test('attente, puis la position et sa précision, qui s’affine', () => {
  const { result } = renderHook(() => usePositionPrecise())
  expect(result.current).toEqual({ etat: 'attente' })
  act(() => {
    suivre({ coords: { latitude: 43.7, longitude: 7.2, accuracy: 340 } })
  })
  expect(result.current).toEqual({ etat: 'trouvee', point: { latitude: 43.7, longitude: 7.2 }, precision: 340 })
  act(() => {
    suivre({ coords: { latitude: 43.7, longitude: 7.2, accuracy: 8 } })
  })
  expect(result.current).toMatchObject({ precision: 8 })
})

test('position introuvable (localisation coupée dans le téléphone) : indisponible', () => {
  const { result } = renderHook(() => usePositionPrecise())
  act(() => {
    echouer({ code: 2 })
  })
  expect(result.current).toEqual({ etat: 'indisponible' })
})

test('délai dépassé sans jamais une position : indisponible ; après une position, on la garde', () => {
  const { result } = renderHook(() => usePositionPrecise())
  act(() => {
    echouer({ code: 3 })
  })
  expect(result.current).toEqual({ etat: 'indisponible' })
  act(() => {
    suivre({ coords: { latitude: 43.7, longitude: 7.2, accuracy: 8 } })
  })
  act(() => {
    echouer({ code: 3 })
  })
  expect(result.current).toMatchObject({ etat: 'trouvee', precision: 8 })
})

test('localisation refusée', () => {
  const { result } = renderHook(() => usePositionPrecise())
  act(() => {
    echouer({ code: 1 })
  })
  expect(result.current).toEqual({ etat: 'refusee' })
})
