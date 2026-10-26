/**
 * QUOI     — la présence : signalée dès que la position est connue, puis chaque minute avec la
 *            dernière ; rien tant qu'elle ne l'est pas.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MA_POSITION } from '@/shared/hooks/useMaPosition'
import { useSignalerPresence } from './useSignalerPresence'

const api = vi.hoisted(() => ({ signalerPresence: vi.fn(() => Promise.resolve()) }))
vi.mock('../api/lieu', () => api)

let client: QueryClient

beforeEach(() => {
  vi.useFakeTimers()
  api.signalerPresence.mockClear()
  client = new QueryClient()
})

afterEach(() => {
  vi.useRealTimers()
})

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

test('rien sans position ; elle arrive : la présence part, puis chaque minute la dernière', () => {
  renderHook(
    () => {
      useSignalerPresence()
    },
    { wrapper },
  )
  expect(api.signalerPresence).not.toHaveBeenCalled()
  act(() => {
    client.setQueryData(MA_POSITION, { latitude: 45, longitude: 6 })
    vi.advanceTimersByTime(0) // TanStack Query prévient ses lecteurs au tick suivant
  })
  expect(api.signalerPresence).toHaveBeenLastCalledWith(45, 6)
  act(() => {
    client.setQueryData(MA_POSITION, { latitude: 45.01, longitude: 6 })
    vi.advanceTimersByTime(0)
  })
  // Un pas ne fait pas partir un signal de plus : le minuteur emporte la dernière position.
  expect(api.signalerPresence).toHaveBeenCalledTimes(1)
  act(() => {
    vi.advanceTimersByTime(60_000)
  })
  expect(api.signalerPresence).toHaveBeenLastCalledWith(45.01, 6)
})
