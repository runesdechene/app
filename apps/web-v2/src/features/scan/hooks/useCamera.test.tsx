/**
 * QUOI     — la caméra : en marche, refusée, et éteinte pour de bon quand on quitte le scanner.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { useCamera } from './useCamera'

function video() {
  const v = document.createElement('video')
  v.play = vi.fn(() => Promise.resolve())
  return { current: v }
}

// jsdom n'a pas de caméra : on pose un faux `navigator.mediaDevices`, retiré après chaque test.
function camera(mediaDevices: object) {
  Object.defineProperty(navigator, 'mediaDevices', { value: mediaDevices, configurable: true })
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'mediaDevices')
})

test('la caméra arrière s’ouvre, puis ses pistes s’arrêtent au démontage', async () => {
  const stop = vi.fn()
  const flux = { getTracks: () => [{ stop }] }
  const getUserMedia = vi.fn(() => Promise.resolve(flux))
  camera({ getUserMedia })
  const ref = video()
  const { result, unmount } = renderHook(() => useCamera(ref, true))
  await waitFor(() => {
    expect(result.current).toBe('en-marche')
  })
  expect(getUserMedia).toHaveBeenCalledWith(
    expect.objectContaining({
      video: expect.objectContaining({ facingMode: 'environment' }) as object,
    }),
  )
  unmount()
  expect(stop).toHaveBeenCalled()
})

test('refusée, elle le dit', async () => {
  camera({ getUserMedia: () => Promise.reject(new Error('NotAllowedError')) })
  const { result } = renderHook(() => useCamera(video(), true))
  await waitFor(() => {
    expect(result.current).toBe('refusee')
  })
})

test('inactive, elle ne demande rien', () => {
  const getUserMedia = vi.fn()
  camera({ getUserMedia })
  const { result } = renderHook(() => useCamera(video(), false))
  expect(result.current).toBe('attente')
  expect(getUserMedia).not.toHaveBeenCalled()
})
