/**
 * QUOI     — « Tes pins » dans la feuille du « + » : en attente d'abord, chacun avec ses jours ;
 *            un appui ouvre la petite carte du pin.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { PinAffiche } from '../hooks/usePins'
import { TesPins } from './TesPins'

const EN_ATTENTE: PinAffiche = {
  id: 'att',
  point: { latitude: 1, longitude: 2 },
  lieuDit: null,
  poseLe: new Date('2026-10-06T12:32:00Z'),
  jours: 15,
  enAttente: true,
  refuse: false,
}

const PINS: PinAffiche[] = [
  EN_ATTENTE,
  {
    id: 's1',
    point: { latitude: 1, longitude: 2 },
    lieuDit: 'Près de Levens',
    poseLe: new Date('2026-09-23T12:00:00Z'),
    jours: 2,
    enAttente: false,
    refuse: false,
  },
  {
    id: 's2',
    point: { latitude: 1, longitude: 2 },
    lieuDit: 'Près de Tourrette-Levens',
    poseLe: new Date('2026-09-18T12:00:00Z'),
    jours: -3,
    enAttente: false,
    refuse: false,
  },
]

test('les trois états d’un pin', async () => {
  const onOuvrir = vi.fn()
  render(<TesPins pins={PINS} onOuvrir={onOuvrir} />)
  expect(screen.getByText(/En attente de réseau · encore 15 jours/)).toBeInTheDocument()
  expect(screen.getByText(/encore 2 jours/)).toBeInTheDocument()
  expect(screen.getByText(/sera ajouté à distance/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /En attente de réseau/ })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: /Près de Levens/ }))
  expect(onOuvrir).toHaveBeenCalledWith('s1')
})

test('un pin refusé par le serveur le dit, et s’ouvre pour être supprimé', async () => {
  const onOuvrir = vi.fn()
  render(<TesPins pins={[{ ...EN_ATTENTE, id: 'ref', refuse: true }]} onOuvrir={onOuvrir} />)
  expect(screen.getByText(/Refusé/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Refusé/ }))
  expect(onOuvrir).toHaveBeenCalledWith('ref')
})

test('aucun pin : la section n’existe pas', () => {
  const { container } = render(<TesPins pins={[]} onOuvrir={() => undefined} />)
  expect(container).toBeEmptyDOMElement()
})
