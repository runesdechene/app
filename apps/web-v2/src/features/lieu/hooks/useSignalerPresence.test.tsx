/**
 * QUOI     — la présence : signalée dès que la position est autorisée, même en cours de route.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { useSignalerPresence } from './useSignalerPresence'

const api = vi.hoisted(() => ({ signalerPresence: vi.fn(() => Promise.resolve()) }))
vi.mock('../api/lieu', () => api)

afterEach(() => {
  vi.unstubAllGlobals()
})

test('autorisée en cours de route : la présence part aussitôt', async () => {
  const statut = { state: 'prompt' as PermissionState, onchange: null as null | (() => void) }
  vi.stubGlobal('navigator', {
    permissions: { query: () => Promise.resolve(statut) },
    geolocation: {
      getCurrentPosition: (
        ok: (p: { coords: { latitude: number; longitude: number } }) => void,
      ) => {
        ok({ coords: { latitude: 45, longitude: 6 } })
      },
    },
  })
  renderHook(() => {
    useSignalerPresence()
  })
  await waitFor(() => {
    expect(statut.onchange).not.toBeNull()
  })
  expect(api.signalerPresence).not.toHaveBeenCalled()
  statut.state = 'granted'
  statut.onchange?.()
  expect(api.signalerPresence).toHaveBeenCalledWith(45, 6)
})
