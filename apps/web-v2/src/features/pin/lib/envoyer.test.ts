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
