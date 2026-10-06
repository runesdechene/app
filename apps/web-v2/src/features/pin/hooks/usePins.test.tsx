/**
 * QUOI     — mes pins : ceux du serveur et ceux qui attendent le réseau, avec leurs jours ;
 *            poser garde d'abord dans le téléphone, puis tente l'envoi.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({ fetchMesPins: vi.fn(), supprimerPin: vi.fn() }))
vi.mock('../api/pins', () => api)
const attente = vi.hoisted(() => ({ lirePinsEnAttente: vi.fn(), garderPinEnAttente: vi.fn(), retirerPinEnAttente: vi.fn() }))
vi.mock('../lib/pinsEnAttente', () => attente)
const envoi = vi.hoisted(() => ({ envoyerPinsEnAttente: vi.fn() }))
vi.mock('../lib/envoyer', () => envoi)

import { useMesPins, usePoserPin } from './usePins'

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-06T12:00:00Z'))
  envoi.envoyerPinsEnAttente.mockResolvedValue({ envoyes: 0, refuses: [] })
  attente.garderPinEnAttente.mockResolvedValue(undefined)
})

test('en attente d’abord, puis du plus récent, chacun avec ses jours', async () => {
  attente.lirePinsEnAttente.mockResolvedValue([
    { id: 'att', latitude: 1, longitude: 2, precision: 8, poseLe: '2026-10-06T11:00:00Z' },
  ])
  api.fetchMesPins.mockResolvedValue({
    validiteJours: 15,
    pins: [{ id: 's1', point: { latitude: 1, longitude: 2 }, lieuDit: 'Près de Levens', poseLe: new Date('2026-09-23T12:00:00Z') }],
  })
  const { result } = renderHook(() => useMesPins(), { wrapper })
  await waitFor(() => {
    expect(result.current.map((p) => [p.id, p.enAttente, p.jours])).toEqual([
      ['att', true, 15],
      ['s1', false, 2],
    ])
  })
})

test('poser : gardé dans le téléphone avec l’heure du téléphone, puis envoi tenté', async () => {
  attente.lirePinsEnAttente.mockResolvedValue([])
  api.fetchMesPins.mockResolvedValue({ validiteJours: 15, pins: [] })
  const { result } = renderHook(() => usePoserPin(), { wrapper })
  await act(() => result.current.mutateAsync({ point: { latitude: 43.7, longitude: 7.2 }, precision: 8 }))
  expect(attente.garderPinEnAttente).toHaveBeenCalledWith(
    expect.objectContaining({ latitude: 43.7, longitude: 7.2, precision: 8, poseLe: '2026-10-06T12:00:00.000Z' }),
  )
  expect(envoi.envoyerPinsEnAttente).toHaveBeenCalled()
})
