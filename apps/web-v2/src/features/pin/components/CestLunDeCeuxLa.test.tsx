/**
 * QUOI     — « C'est l'un de ceux-là ? » : « C'est lui » visite et ferme le pin ; « Non, c'est un
 *            autre lieu » ouvre l'ajout ; sans lieu proche, on passe directement à l'ajout.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({ fetchLieuxProches: vi.fn(), visiterDepuisPin: vi.fn() }))
vi.mock('../api/pins', () => api)

import { CestLunDeCeuxLa } from './CestLunDeCeuxLa'

const props = {
  pin: 'p1',
  poseLe: new Date('2026-10-03T12:00:00Z'),
  onVisite: vi.fn(),
  onAutre: vi.fn(),
  onFermer: vi.fn(),
}

const CHAPELLE = { id: 'l1', nom: 'Chapelle Saint-Roch', imageUrl: null, metres: 40 }

function monter() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <CestLunDeCeuxLa {...props} />
    </QueryClientProvider>,
  )
  return client
}

beforeEach(() => {
  vi.resetAllMocks()
})

test('« C’est lui » : visite datée du pin, puis la fiche du lieu', async () => {
  api.fetchLieuxProches.mockResolvedValue([CHAPELLE])
  api.visiterDepuisPin.mockResolvedValue({ visite: true })
  const invalider = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
  monter()
  await userEvent.click(await screen.findByRole('button', { name: /C’est lui.*Chapelle Saint-Roch/ }))
  expect(api.visiterDepuisPin).toHaveBeenCalledWith('p1', 'l1')
  await waitFor(() => {
    expect(props.onVisite).toHaveBeenCalledWith('l1', true)
  })
  // Le pin fermé quitte aussitôt « Tes pins » ; la fiche du lieu visité se recharge.
  expect(invalider).toHaveBeenCalledWith({ queryKey: ['pins'] })
  expect(invalider).toHaveBeenCalledWith({ queryKey: ['lieu', 'l1'] })
  invalider.mockRestore()
})

test('« Non, c’est un autre lieu » ouvre l’ajout, sans visite', async () => {
  api.fetchLieuxProches.mockResolvedValue([CHAPELLE])
  monter()
  await userEvent.click(await screen.findByRole('button', { name: /Non, c’est un autre lieu/ }))
  expect(props.onAutre).toHaveBeenCalled()
  expect(api.visiterDepuisPin).not.toHaveBeenCalled()
})

test('aucun lieu à 200 m : on passe tout de suite à l’ajout', async () => {
  api.fetchLieuxProches.mockResolvedValue([])
  monter()
  await waitFor(() => {
    expect(props.onAutre).toHaveBeenCalled()
  })
})
