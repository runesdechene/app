/**
 * QUOI     — mes pins : ceux du serveur et ceux qui attendent le réseau, avec leurs jours ;
 *            poser garde dans le téléphone et rend la main aussitôt, l'envoi part derrière ;
 *            un serveur muet ne fait perdre aucun pin ; seuls les pins de mon compte se montrent.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({ fetchMesPins: vi.fn(), supprimerPin: vi.fn(), monIdentifiant: vi.fn() }))
vi.mock('../api/pins', () => api)
const attente = vi.hoisted(() => ({ lirePinsEnAttente: vi.fn(), garderPinEnAttente: vi.fn(), retirerPinEnAttente: vi.fn() }))
vi.mock('../lib/pinsEnAttente', async (vrai) => ({ ...(await vrai<typeof import('../lib/pinsEnAttente')>()), ...attente }))
const envoi = vi.hoisted(() => ({ envoyerPinsEnAttente: vi.fn() }))
vi.mock('../lib/envoyer', () => envoi)

const reseau = vi.hoisted(() => ({ enLigne: true }))
vi.mock('@/shared/hooks/useEnLigne', () => ({ useEnLigne: () => reseau.enLigne }))

import {
  lireTout,
  PINS,
  useEnvoyerALOuverture,
  useEnvoyerPins,
  useMesPins,
  usePoserPin,
  useSupprimerPin,
  type PinAffiche,
} from './usePins'

let client = new QueryClient()

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

let horsLigne = false
const SERVEUR_S1 = { id: 's1', point: { latitude: 1, longitude: 2 }, lieuDit: 'Près de Levens', poseLe: new Date('2026-09-23T12:00:00Z') }
const S1_AFFICHE: PinAffiche = { ...SERVEUR_S1, jours: 2, enAttente: false, refuse: false }
const ATT = { id: 'att', latitude: 1, longitude: 2, precision: 8, poseLe: '2026-10-06T11:00:00Z' }

beforeEach(() => {
  vi.resetAllMocks()
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  reseau.enLigne = true
  horsLigne = false
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => !horsLigne)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-06T12:00:00Z'))
  envoi.envoyerPinsEnAttente.mockResolvedValue({ envoyes: 0, refuses: [] })
  attente.garderPinEnAttente.mockResolvedValue(undefined)
  attente.retirerPinEnAttente.mockResolvedValue(true)
  api.monIdentifiant.mockResolvedValue('moi')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

test('en attente d’abord, puis du plus récent, chacun avec ses jours', async () => {
  attente.lirePinsEnAttente.mockResolvedValue([ATT])
  api.fetchMesPins.mockResolvedValue({ validiteJours: 15, pins: [SERVEUR_S1] })
  const { result } = renderHook(() => useMesPins(), { wrapper })
  await waitFor(() => {
    expect(result.current.map((p) => [p.id, p.enAttente, p.jours])).toEqual([
      ['att', true, 15],
      ['s1', false, 2],
    ])
  })
})

test('poser : gardé dans le téléphone avec l’heure du téléphone et mon compte', async () => {
  attente.lirePinsEnAttente.mockResolvedValue([])
  api.fetchMesPins.mockResolvedValue({ validiteJours: 15, pins: [] })
  client.setQueryData(['moi'], 'moi')
  const { result } = renderHook(() => usePoserPin(), { wrapper })
  await act(() => result.current.mutateAsync({ point: { latitude: 43.7, longitude: 7.2 }, precision: 8 }))
  expect(attente.garderPinEnAttente).toHaveBeenCalledWith(
    expect.objectContaining({ latitude: 43.7, longitude: 7.2, precision: 8, poseLe: '2026-10-06T12:00:00.000Z', userId: 'moi' }),
  )
  expect(envoi.envoyerPinsEnAttente).toHaveBeenCalled()
})

test('poser ne fait jamais attendre l’envoi : la pose rend la main pendant qu’il traîne', async () => {
  attente.lirePinsEnAttente.mockResolvedValue([])
  api.fetchMesPins.mockResolvedValue({ validiteJours: 15, pins: [] })
  envoi.envoyerPinsEnAttente.mockReturnValue(new Promise(() => undefined)) // réseau faible : jamais fini
  const { result } = renderHook(() => usePoserPin(), { wrapper })
  let id: string | undefined
  await act(async () => {
    id = await result.current.mutateAsync({ point: { latitude: 43.7, longitude: 7.2 }, precision: 8 })
  })
  expect(typeof id).toBe('string')
  expect(envoi.envoyerPinsEnAttente).toHaveBeenCalled()
})

test('poser hors ligne : aucun envoi tenté', async () => {
  horsLigne = true
  attente.lirePinsEnAttente.mockResolvedValue([])
  const { result } = renderHook(() => usePoserPin(), { wrapper })
  await act(() => result.current.mutateAsync({ point: { latitude: 43.7, longitude: 7.2 }, precision: 8 }))
  expect(attente.garderPinEnAttente).toHaveBeenCalled()
  expect(envoi.envoyerPinsEnAttente).not.toHaveBeenCalled()
})

test('un envoi qui ne fait que refuser un pin relit quand même la liste', async () => {
  attente.lirePinsEnAttente.mockResolvedValue([])
  api.fetchMesPins.mockResolvedValue({ validiteJours: 15, pins: [] })
  // l'envoi finit après la première lecture : TanStack ne relit une requête sans données qu'une fois
  envoi.envoyerPinsEnAttente.mockImplementation(
    () => new Promise((fin) => setTimeout(() => { fin({ envoyes: 0, refuses: ['a'] }); }, 50)),
  )
  renderHook(
    () => {
      useMesPins()
      useEnvoyerPins()
    },
    { wrapper },
  )
  await waitFor(() => { expect(attente.lirePinsEnAttente).toHaveBeenCalledTimes(2); })
})

test('un envoi qui échoue ne laisse pas de promesse rejetée', async () => {
  envoi.envoyerPinsEnAttente.mockRejectedValue(new Error('IndexedDB'))
  const { unmount } = renderHook(() => { useEnvoyerPins(); }, { wrapper })
  await waitFor(() => { expect(envoi.envoyerPinsEnAttente).toHaveBeenCalled(); })
  unmount()
})

test('revenir dans l’app (onglet de nouveau visible) envoie les pins en attente', async () => {
  renderHook(() => { useEnvoyerPins(); }, { wrapper })
  await waitFor(() => { expect(envoi.envoyerPinsEnAttente).toHaveBeenCalledTimes(1); })
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await waitFor(() => { expect(envoi.envoyerPinsEnAttente).toHaveBeenCalledTimes(2); })
})

test('ouvrir le « + » envoie les pins en attente, puis relit la liste', async () => {
  envoi.envoyerPinsEnAttente.mockResolvedValue({ envoyes: 1, refuses: [] })
  const invalider = vi.spyOn(client, 'invalidateQueries')
  renderHook(() => { useEnvoyerALOuverture(); }, { wrapper })
  await waitFor(() => { expect(invalider).toHaveBeenCalledWith({ queryKey: PINS }); })
  expect(envoi.envoyerPinsEnAttente).toHaveBeenCalledTimes(1)
})

test('en ligne sans vrai réseau : le pin posé et les pins déjà connus restent', async () => {
  client.setQueryData(PINS, [S1_AFFICHE])
  attente.lirePinsEnAttente.mockResolvedValue([ATT])
  api.fetchMesPins.mockRejectedValue(new TypeError('Failed to fetch'))
  expect((await lireTout(client)).map((p) => [p.id, p.enAttente, p.jours])).toEqual([
    ['att', true, 15],
    ['s1', false, 2],
  ])
})

test('hors ligne : on ne demande rien au serveur, et ses pins connus restent', async () => {
  horsLigne = true
  client.setQueryData(PINS, [{ ...S1_AFFICHE, id: 'att', enAttente: true }, S1_AFFICHE])
  attente.lirePinsEnAttente.mockResolvedValue([ATT])
  expect((await lireTout(client)).map((p) => p.id)).toEqual(['att', 's1'])
  expect(api.fetchMesPins).not.toHaveBeenCalled()
})

test('en ligne, une erreur serveur sans rien à montrer remonte : la requête réessaiera', async () => {
  attente.lirePinsEnAttente.mockResolvedValue([])
  api.fetchMesPins.mockRejectedValue(new Error('500'))
  await expect(lireTout(client)).rejects.toThrow('500')
})

test('les pins posés par un autre compte sur ce téléphone ne se montrent pas', async () => {
  attente.lirePinsEnAttente.mockResolvedValue([
    { ...ATT, id: 'autre', userId: 'quelquun' },
    { ...ATT, id: 'mien', userId: 'moi' },
    { ...ATT, id: 'ancien' }, // posé avant que le pin retienne son compte
  ])
  api.fetchMesPins.mockResolvedValue({ validiteJours: 15, pins: [] })
  expect((await lireTout(client)).map((p) => p.id)).toEqual(['mien', 'ancien'])
})

test('supprimer un pin du téléphone marche hors ligne', async () => {
  horsLigne = true
  attente.lirePinsEnAttente.mockResolvedValue([])
  const { result } = renderHook(() => useSupprimerPin(), { wrapper })
  await act(() => result.current.mutateAsync({ ...S1_AFFICHE, id: 'att', enAttente: true }))
  expect(attente.retirerPinEnAttente).toHaveBeenCalledWith('att')
})
