/**
 * QUOI     — la petite carte d'un pin : « Compléter le lieu », « Voir sur la carte » (pins envoyés
 *            seulement), « Supprimer ce pin ».
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import type { PinAffiche } from '../hooks/usePins'
import { FichePin } from './FichePin'

const pins = vi.hoisted(() => ({ liste: [] as PinAffiche[], suppressionRatee: false }))
vi.mock('../hooks/usePins', () => ({
  useMesPins: () => pins.liste,
  useSupprimerPin: () => ({ mutate: vi.fn(), isPending: false, isError: pins.suppressionRatee }),
}))

const ENVOYE: PinAffiche = {
  id: 'p1',
  point: { latitude: 43.7, longitude: 7.2 },
  lieuDit: 'Près de Levens',
  poseLe: new Date('2026-09-23T12:00:00Z'),
  jours: 12,
  enAttente: false,
  refuse: false,
}

beforeEach(() => {
  pins.liste = [ENVOYE]
  pins.suppressionRatee = false
})

test('une suppression ratée se dit', () => {
  pins.suppressionRatee = true
  monter('p1')
  expect(screen.getByRole('alert')).toHaveTextContent('Le pin n’a pas pu être supprimé. Réessaie.')
})

function monter(id: string, onVoirSurLaCarte = vi.fn()) {
  render(
    <FichePin
      id={id}
      onFermer={vi.fn()}
      onCompleter={vi.fn()}
      onVoirSurLaCarte={onVoirSurLaCarte}
    />,
  )
  return onVoirSurLaCarte
}

test('« Voir sur la carte » : un pin envoyé la propose, et un appui la déclenche', async () => {
  const onVoir = monter('p1')
  await userEvent.click(screen.getByRole('button', { name: 'Voir sur la carte' }))
  expect(onVoir).toHaveBeenCalledTimes(1)
})

test('« Voir sur la carte » : pas pour un pin encore dans le téléphone', () => {
  pins.liste = [{ ...ENVOYE, id: 'att', enAttente: true }]
  monter('att')
  expect(screen.queryByRole('button', { name: 'Voir sur la carte' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Supprimer ce pin' })).toBeInTheDocument()
})
