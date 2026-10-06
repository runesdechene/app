/**
 * QUOI     — envoyer les pins en attente : un par un, retirés une fois acceptés ; une coupure
 *            arrête l'envoi sans rien perdre ; un refus définitif garde le pin et le signale.
 */
import { beforeEach, expect, test, vi } from 'vitest'

const attente = vi.hoisted(() => ({ lirePinsEnAttente: vi.fn(), retirerPinEnAttente: vi.fn(), garderPinEnAttente: vi.fn() }))
vi.mock('./pinsEnAttente', () => attente)
const api = vi.hoisted(() => ({ poserPin: vi.fn() }))
vi.mock('../api/pins', () => api)
const adresse = vi.hoisted(() => ({ endroitDe: vi.fn() }))
vi.mock('@/shared/lib/adresse', () => adresse)

import { envoyerPinsEnAttente } from './envoyer'

const A = { id: 'a', latitude: 1, longitude: 2, precision: 8, poseLe: '2026-10-06T12:00:00Z' }
const B = { ...A, id: 'b' }

beforeEach(() => {
  vi.resetAllMocks()
  attente.retirerPinEnAttente.mockResolvedValue(undefined)
  attente.garderPinEnAttente.mockResolvedValue(undefined)
  adresse.endroitDe.mockResolvedValue({ titre: 'Près de Colomars', detail: '', adresse: '' })
})

test('deux pins acceptés : envoyés avec leur lieu-dit, puis retirés', async () => {
  attente.lirePinsEnAttente.mockResolvedValue([A, B])
  api.poserPin.mockResolvedValue(undefined)
  expect(await envoyerPinsEnAttente()).toEqual({ envoyes: 2, refuses: [] })
  expect(api.poserPin).toHaveBeenCalledWith(A, 'Près de Colomars')
  expect(attente.retirerPinEnAttente).toHaveBeenCalledWith('a')
  expect(attente.retirerPinEnAttente).toHaveBeenCalledWith('b')
})

test('le géocodeur muet n’empêche pas l’envoi : lieu-dit vide', async () => {
  attente.lirePinsEnAttente.mockResolvedValue([A])
  adresse.endroitDe.mockRejectedValue(new Error('géocodeur indisponible'))
  api.poserPin.mockResolvedValue(undefined)
  await envoyerPinsEnAttente()
  expect(api.poserPin).toHaveBeenCalledWith(A, null)
})

test('un envoi interrompu se reprend : la coupure arrête, rien n’est retiré', async () => {
  attente.lirePinsEnAttente.mockResolvedValue([A, B])
  api.poserPin.mockRejectedValue(new TypeError('Failed to fetch'))
  expect(await envoyerPinsEnAttente()).toEqual({ envoyes: 0, refuses: [] })
  expect(api.poserPin).toHaveBeenCalledTimes(1)
  expect(attente.retirerPinEnAttente).not.toHaveBeenCalled()
})

test('refus définitif (date impossible) : le pin est gardé et signalé, les autres partent', async () => {
  attente.lirePinsEnAttente.mockResolvedValue([A, B])
  api.poserPin
    .mockRejectedValueOnce({ code: '22023', message: 'Date de pose impossible' })
    .mockResolvedValueOnce(undefined)
  expect(await envoyerPinsEnAttente()).toEqual({ envoyes: 1, refuses: ['a'] })
  expect(attente.garderPinEnAttente).toHaveBeenCalledWith({ ...A, refuse: true })
  expect(attente.retirerPinEnAttente).toHaveBeenCalledTimes(1)
  expect(attente.retirerPinEnAttente).toHaveBeenCalledWith('b')
})

test('un pin déjà refusé ne repart plus', async () => {
  attente.lirePinsEnAttente.mockResolvedValue([{ ...A, refuse: true }])
  expect(await envoyerPinsEnAttente()).toEqual({ envoyes: 0, refuses: [] })
  expect(api.poserPin).not.toHaveBeenCalled()
})

test.each([
  { code: 'PGRST301', message: 'JWT expired' },
  { code: '42501', message: 'connexion requise' },
])('une erreur du serveur qui n’est pas un refus du pin ($code) arrête l’envoi, sans rien marquer', async (erreur) => {
  attente.lirePinsEnAttente.mockResolvedValue([A, B])
  api.poserPin.mockRejectedValue(erreur)
  expect(await envoyerPinsEnAttente()).toEqual({ envoyes: 0, refuses: [] })
  expect(api.poserPin).toHaveBeenCalledTimes(1)
  expect(attente.garderPinEnAttente).not.toHaveBeenCalled()
  expect(attente.retirerPinEnAttente).not.toHaveBeenCalled()
})

test('GPS trop imprécis (P0001) : refus définitif aussi', async () => {
  attente.lirePinsEnAttente.mockResolvedValue([A])
  api.poserPin.mockRejectedValue({ code: 'P0001', message: 'Précision insuffisante' })
  expect(await envoyerPinsEnAttente()).toEqual({ envoyes: 0, refuses: ['a'] })
})

test('deux envois à la fois n’en font qu’un : chaque pin part une seule fois', async () => {
  attente.lirePinsEnAttente.mockResolvedValueOnce([A, B]).mockResolvedValue([])
  api.poserPin.mockResolvedValue(undefined)
  const [premier, second] = await Promise.all([envoyerPinsEnAttente(), envoyerPinsEnAttente()])
  expect(api.poserPin).toHaveBeenCalledTimes(2)
  expect(second).toBe(premier)
  expect(premier).toEqual({ envoyes: 2, refuses: [] })
})

test('un pin posé pendant un envoi part dans une seconde passe', async () => {
  const C = { ...A, id: 'c' }
  attente.lirePinsEnAttente.mockResolvedValueOnce([A]).mockResolvedValueOnce([C]).mockResolvedValue([])
  api.poserPin.mockResolvedValue(undefined)
  const premier = envoyerPinsEnAttente()
  const second = envoyerPinsEnAttente() // arrive pendant la première passe
  expect(await second).toEqual({ envoyes: 2, refuses: [] })
  expect(await premier).toEqual({ envoyes: 2, refuses: [] })
  expect(api.poserPin).toHaveBeenCalledWith(C, 'Près de Colomars')
  expect(attente.lirePinsEnAttente).toHaveBeenCalledTimes(2)
})
