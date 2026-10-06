/**
 * QUOI     — poser un pin : le bouton n'agit qu'avec un GPS précis (± 200 m) ; une fois posé,
 *            l'écran dit les 15 jours, et sans réseau qu'il partira tout seul.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

const position = vi.hoisted(() => ({ usePositionPrecise: vi.fn() }))
vi.mock('@/shared/hooks/usePositionPrecise', () => ({ ...position, PRECISION_MAX_M: 200 }))
const reseau = vi.hoisted(() => ({ useEnLigne: vi.fn() }))
vi.mock('@/shared/hooks/useEnLigne', () => reseau)
const pins = vi.hoisted(() => ({ usePoserPin: vi.fn() }))
vi.mock('../hooks/usePins', () => pins)
vi.mock('@/shared/hooks/useEndroit', () => ({ useEndroit: () => ({ titre: 'Près de Colomars', detail: 'Alpes-Maritimes', adresse: '' }) }))

import { PoserPin } from './PoserPin'

const poser = vi.fn()

beforeEach(() => {
  vi.resetAllMocks()
  reseau.useEnLigne.mockReturnValue(true)
  pins.usePoserPin.mockReturnValue({ mutate: poser, isSuccess: false, isPending: false })
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
  pins.usePoserPin.mockReturnValue({ mutate: poser, isSuccess: true, isPending: false })
  monter()
  expect(screen.getByRole('heading', { name: 'Ton pin est posé' })).toBeInTheDocument()
  expect(screen.getByText(/il partira tout seul/)).toBeInTheDocument()
  expect(screen.getByText(/Prends tes photos avec ton téléphone/)).toBeInTheDocument()
})
