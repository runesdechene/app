/**
 * QUOI     — poser un pin : le bouton n'agit qu'avec un GPS précis (± 200 m) ; une fois posé,
 *            l'écran dit les 15 jours, et sans réseau qu'il partira tout seul.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { FausseCarte } from '@/test/fausseCarte'
import type { PinAffiche } from '../hooks/usePins'

const position = vi.hoisted(() => ({ usePositionPrecise: vi.fn() }))
vi.mock('@/shared/hooks/usePositionPrecise', () => ({ ...position, PRECISION_MAX_M: 200 }))
const reseau = vi.hoisted(() => ({ useEnLigne: vi.fn() }))
vi.mock('@/shared/hooks/useEnLigne', () => reseau)
const pins = vi.hoisted(() => ({ usePoserPin: vi.fn(), useMesPins: vi.fn() }))
vi.mock('../hooks/usePins', () => pins)
vi.mock('@/shared/hooks/useEndroit', () => ({ useEndroit: () => ({ titre: 'Près de Colomars', detail: 'Alpes-Maritimes', adresse: '' }) }))

import { PoserPin } from './PoserPin'

const poser = vi.fn()
const PIN: PinAffiche = {
  id: 'p1',
  point: { latitude: 43.7, longitude: 7.2 },
  lieuDit: null,
  poseLe: new Date('2026-10-06T12:00:00Z'),
  jours: 15,
  enAttente: false,
  refuse: false,
}

beforeEach(() => {
  vi.resetAllMocks()
  reseau.useEnLigne.mockReturnValue(true)
  pins.usePoserPin.mockReturnValue({ mutate: poser, isSuccess: false, isPending: false })
  pins.useMesPins.mockReturnValue([])
})

function monter() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PoserPin onFermer={() => undefined} />
    </QueryClientProvider>,
  )
}

test('GPS précis : « Poser mon pin ici » pose à cette position', async () => {
  position.usePositionPrecise.mockReturnValue({ etat: 'trouvee', point: { latitude: 43.7, longitude: 7.2 }, precision: 8 })
  monter()
  expect(screen.getByText(/± 8 m/)).toBeInTheDocument()
  expect(screen.getByText(/15 jours pour le compléter/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Poser mon pin ici' }))
  expect(poser).toHaveBeenCalledWith({ point: { latitude: 43.7, longitude: 7.2 }, precision: 8 })
})

test('GPS imprécis (± 340 m) : le bouton est grisé et dit pourquoi', () => {
  position.usePositionPrecise.mockReturnValue({ etat: 'trouvee', point: { latitude: 43.7, longitude: 7.2 }, precision: 340 })
  monter()
  expect(screen.getByRole('button', { name: 'GPS trop imprécis (± 340 m)' })).toBeDisabled()
})

test('localisation refusée : on ne pose pas, et on dit comment l’autoriser', () => {
  position.usePositionPrecise.mockReturnValue({ etat: 'refusee' })
  monter()
  expect(screen.getByText(/Autorise la localisation/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Poser mon pin ici' })).not.toBeInTheDocument()
})

test('posé sans réseau : il partira tout seul', () => {
  position.usePositionPrecise.mockReturnValue({ etat: 'trouvee', point: { latitude: 43.7, longitude: 7.2 }, precision: 8 })
  reseau.useEnLigne.mockReturnValue(false)
  pins.usePoserPin.mockReturnValue({ mutate: poser, isSuccess: true, isPending: false, data: 'p1' })
  pins.useMesPins.mockReturnValue([{ ...PIN, enAttente: true }])
  monter()
  expect(screen.getByRole('heading', { name: 'Ton pin est posé' })).toBeInTheDocument()
  expect(screen.getByText(/dans ton téléphone/)).toBeInTheDocument()
  expect(screen.getByText(/il partira tout seul/)).toBeInTheDocument()
  expect(screen.getByText(/Prends tes photos avec ton téléphone/)).toBeInTheDocument()
})

test('posé avec un réseau faible : encore dans le téléphone, l’écran le dit (pas « encore 15 jours »)', () => {
  position.usePositionPrecise.mockReturnValue({ etat: 'trouvee', point: { latitude: 43.7, longitude: 7.2 }, precision: 8 })
  pins.usePoserPin.mockReturnValue({ mutate: poser, isSuccess: true, isPending: false, data: 'p1' })
  pins.useMesPins.mockReturnValue([{ ...PIN, enAttente: true }])
  monter()
  expect(screen.getByText(/dans ton téléphone/)).toBeInTheDocument()
  expect(screen.getByText(/il partira tout seul/)).toBeInTheDocument()
  expect(screen.queryByText(/encore 15 jours/)).not.toBeInTheDocument()
})

test('posé puis refusé par le serveur pendant que l’écran est ouvert : l’écran le dit', () => {
  position.usePositionPrecise.mockReturnValue({ etat: 'trouvee', point: { latitude: 43.7, longitude: 7.2 }, precision: 8 })
  pins.usePoserPin.mockReturnValue({ mutate: poser, isSuccess: true, isPending: false, data: 'p1' })
  pins.useMesPins.mockReturnValue([{ ...PIN, enAttente: true, refuse: true }])
  monter()
  expect(screen.getByText(/Le serveur a refusé ce pin/)).toBeInTheDocument()
  expect(screen.queryByText(/il partira tout seul/)).not.toBeInTheDocument()
})

test('posé et envoyé : encore 15 jours pour le compléter', () => {
  position.usePositionPrecise.mockReturnValue({ etat: 'trouvee', point: { latitude: 43.7, longitude: 7.2 }, precision: 8 })
  pins.usePoserPin.mockReturnValue({ mutate: poser, isSuccess: true, isPending: false, data: 'p1' })
  pins.useMesPins.mockReturnValue([PIN])
  monter()
  expect(screen.getByText(/encore 15 jours pour le compléter/)).toBeInTheDocument()
  expect(screen.queryByText(/dans ton téléphone/)).not.toBeInTheDocument()
})

test('le téléphone ne trouve pas sa position : on ne pose pas, et on dit quoi faire', () => {
  position.usePositionPrecise.mockReturnValue({ etat: 'indisponible' })
  monter()
  expect(screen.getByText(/Ton téléphone ne trouve pas sa position/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Poser mon pin ici' })).not.toBeInTheDocument()
})

test('la carte n’est pas interactive et se centre sur la position connue', () => {
  position.usePositionPrecise.mockReturnValue({ etat: 'trouvee', point: { latitude: 43.7, longitude: 7.2 }, precision: 8 })
  monter()
  expect(FausseCarte.derniere?.options).toMatchObject({ interactive: false })
  expect(FausseCarte.derniere?.jumpTo).toHaveBeenCalledWith({ center: [7.2, 43.7], zoom: 16 })
})
