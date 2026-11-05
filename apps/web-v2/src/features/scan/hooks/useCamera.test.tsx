/**
 * QUOI     — la caméra : en marche, refusée, éteinte pour de bon quand on quitte le scanner, et
 *            retournée vers soi pour scanner le t-shirt qu'on porte.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { useCamera, type Face } from './useCamera'

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
  const { result, unmount } = renderHook(() => useCamera(ref, true, 'arriere'))
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
  const { result } = renderHook(() => useCamera(video(), true, 'arriere'))
  await waitFor(() => {
    expect(result.current).toBe('refusee')
  })
})

test('inactive, elle ne demande rien', () => {
  const getUserMedia = vi.fn()
  camera({ getUserMedia })
  const { result } = renderHook(() => useCamera(video(), false, 'arriere'))
  expect(result.current).toBe('attente')
  expect(getUserMedia).not.toHaveBeenCalled()
})

test('retournée vers soi : l’ancienne caméra s’éteint, la caméra avant s’ouvre', async () => {
  const stop = vi.fn()
  const getUserMedia = vi.fn(() => Promise.resolve({ getTracks: () => [{ stop }] }))
  camera({ getUserMedia })
  const ref = video()
  const { result, rerender } = renderHook(({ face }) => useCamera(ref, true, face), {
    initialProps: { face: 'arriere' as Face },
  })
  await waitFor(() => {
    expect(result.current).toBe('en-marche')
  })
  rerender({ face: 'avant' })
  expect(stop).toHaveBeenCalled()
  await waitFor(() => {
    expect(getUserMedia).toHaveBeenLastCalledWith(
      expect.objectContaining({ video: expect.objectContaining({ facingMode: 'user' }) as object }),
    )
  })
})
