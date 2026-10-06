/**
 * QUOI     — compléter un pin ouvre l'ajout sur un brouillon né du pin ; si un autre brouillon
 *            attend, on demande d'abord « Remplacer ton brouillon en cours ? ».
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { BROUILLON_VIDE, type Brouillon } from '../lib/brouillon'
import { DepuisUnPin } from './DepuisUnPin'

const stockage = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn<(cle: string, valeur: Brouillon) => Promise<void>>(() => Promise.resolve()),
  del: vi.fn(() => Promise.resolve()),
}))
vi.mock('idb-keyval', () => stockage)

const PIN = {
  id: 'p1',
  point: { latitude: 43.7, longitude: 7.2 },
  poseLe: new Date('2026-10-03T12:00:00Z'),
}
const ouvrir = vi.fn()

beforeEach(() => {
  stockage.get.mockReset()
  stockage.set.mockClear()
  ouvrir.mockReset()
  stockage.get.mockResolvedValue(undefined)
})

// Le dernier brouillon enregistré (second argument de `set`).
function dernierEnregistre(): Brouillon | undefined {
  return stockage.set.mock.calls.at(-1)?.[1]
}

test('aucun brouillon : celui du pin s’enregistre, et l’ajout s’ouvre', async () => {
  render(<DepuisUnPin pin={PIN} onOuvrir={ouvrir} />)
  await waitFor(() => {
    expect(ouvrir).toHaveBeenCalled()
  })
  expect(dernierEnregistre()?.pin?.id).toBe('p1')
})

test('un brouillon en cours : on demande avant de le remplacer', async () => {
  stockage.get.mockResolvedValue({ ...BROUILLON_VIDE, nom: 'Château' })
  render(<DepuisUnPin pin={PIN} onOuvrir={ouvrir} />)
  expect(await screen.findByText('Remplacer ton brouillon en cours ?')).toBeInTheDocument()
  expect(ouvrir).not.toHaveBeenCalled()
  expect(stockage.set).not.toHaveBeenCalled()
})

test('« Remplacer » : le brouillon du pin prend la place', async () => {
  stockage.get.mockResolvedValue({ ...BROUILLON_VIDE, nom: 'Château' })
  render(<DepuisUnPin pin={PIN} onOuvrir={ouvrir} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Remplacer' }))
  await waitFor(() => {
    expect(ouvrir).toHaveBeenCalled()
  })
  expect(dernierEnregistre()?.pin?.id).toBe('p1')
  expect(dernierEnregistre()?.nom).toBe('')
})

test('« Garder mon brouillon » : rien ne s’écrit, l’ajout s’ouvre sur l’ancien', async () => {
  stockage.get.mockResolvedValue({ ...BROUILLON_VIDE, nom: 'Château' })
  render(<DepuisUnPin pin={PIN} onOuvrir={ouvrir} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Garder mon brouillon' }))
  expect(ouvrir).toHaveBeenCalled()
  expect(stockage.set).not.toHaveBeenCalled()
})

test('le brouillon en cours est déjà celui de ce pin : pas de question', async () => {
  stockage.get.mockResolvedValue({
    ...BROUILLON_VIDE,
    nom: 'Château',
    pin: { id: 'p1', point: PIN.point, poseLe: PIN.poseLe.toISOString() },
  })
  render(<DepuisUnPin pin={PIN} onOuvrir={ouvrir} />)
  await waitFor(() => {
    expect(ouvrir).toHaveBeenCalled()
  })
  expect(screen.queryByText('Remplacer ton brouillon en cours ?')).not.toBeInTheDocument()
})
