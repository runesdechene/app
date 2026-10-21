import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import type { Recompense } from '../api/lireLieu'
import type { LieuProche } from '../lib/lieuAPortee'
import { BoutonAPortee } from './BoutonAPortee'

const position_ = vi.hoisted(() => vi.fn())
vi.mock('@/shared/hooks/usePosition', () => ({ usePosition: position_ }))
const visite_ = vi.hoisted(() => vi.fn())
vi.mock('../hooks/useVisite', () => ({ useVisite: visite_ }))
vi.mock('./ParcoursRevendication', () => ({
  ParcoursRevendication: ({ id }: { id: string }) => <p>parcours de {id}</p>,
}))

const ICI = { lat: 43.8, lng: 7.3 }
const COARAZE: LieuProche = {
  id: 'coaraze',
  nom: 'Château de Coaraze',
  lat: 43.8 + 40 / 111_195,
  lng: 7.3,
  nature: 'lieu',
  revendication: null,
}
const VISITE: Recompense = { rang: 18, gain: 3, niveau: 12, avant: 0.6, apres: 0.64 }
const visiter = vi.fn((): Promise<Recompense> => Promise.resolve(VISITE))
const onAPortee = vi.fn()

beforeEach(() => {
  visiter.mockClear()
  onAPortee.mockClear()
})

function afficher(position: unknown, erreur: string | null = null) {
  position_.mockReturnValue({ position, demander: vi.fn() })
  visite_.mockReturnValue({ visiter, enCours: false, erreur })
  render(
    <BoutonAPortee lieux={[COARAZE]} monNom="Uriel" onAPortee={onAPortee} onVoirLeLieu={vi.fn()} />,
  )
}

test('sans position, rien', () => {
  afficher('inconnue')
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(onAPortee).toHaveBeenLastCalledWith(null)
})

test('un lieu à portée : « Marquer ma visite », son nom et sa distance ; la carte l’entoure', () => {
  afficher(ICI)
  expect(screen.getByRole('button', { name: /Marquer ma visite/ })).toHaveTextContent(
    'Château de Coaraze · à 40 m',
  )
  expect(onAPortee).toHaveBeenLastCalledWith('coaraze')
})

test('toucher marque la visite à ma position, puis ouvre le parcours', async () => {
  afficher(ICI)
  await userEvent.click(screen.getByRole('button', { name: /Marquer ma visite/ }))
  expect(visiter).toHaveBeenCalledWith(ICI)
  expect(screen.getByText('parcours de coaraze')).toBeInTheDocument()
})

test('une visite refusée : le message, pas de parcours', async () => {
  visiter.mockRejectedValueOnce(new Error('Trop loin'))
  afficher(ICI, 'Tu es encore trop loin pour marquer ta visite.')
  await userEvent.click(screen.getByRole('button', { name: /Marquer ma visite/ }))
  expect(screen.getByRole('alert')).toHaveTextContent('Tu es encore trop loin')
  expect(screen.queryByText(/parcours de/)).not.toBeInTheDocument()
})
