import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import type { FicheLieu } from '../api/lireLieu'
import { BoutonVisite } from './BoutonVisite'

const position_ = vi.hoisted(() => vi.fn())
const visite_ = vi.hoisted(() => vi.fn())
vi.mock('@/shared/hooks/usePosition', () => ({ usePosition: position_ }))
vi.mock('../hooks/useVisite', () => ({ useVisite: visite_ }))

const visiter = vi.fn(() => Promise.resolve())
const onVisite = vi.fn()
const onSouvenir = vi.fn()

beforeEach(() => {
  visiter.mockClear()
  onVisite.mockClear()
  onSouvenir.mockClear()
  visite_.mockReturnValue({ visiter, enCours: false, erreur: null })
})

function afficher({
  lat,
  lng,
  visiteLe,
  souvenirLe = null,
  genre = 'm',
}: {
  lat: number
  lng: number
  visiteLe: string | null
  souvenirLe?: string | null
  genre?: 'm' | 'f'
}) {
  const fiche: Pick<FicheLieu, 'id' | 'lat' | 'lng' | 'moi'> = {
    id: 'a',
    lat,
    lng,
    moi: { visiteLe, souvenirLe, envie: false, decouvert: true, genre },
  }
  render(<BoutonVisite fiche={fiche} onVisite={onVisite} onSouvenir={onSouvenir} />)
}

const loin = { lat: 47.465, lng: 6 }

test.each([
  ['inconnue', null, 'Me localiser pour visiter', true],
  ['refusee', null, 'Position refusée', false],
  [{ lat: 45.0009, lng: 6 }, null, 'Marquer ma visite (GPS)', true],
  [{ lat: 47.465, lng: 6 }, null, 'Marquer ma visite · 274 km trop loin', false],
  [{ lat: 45.0009, lng: 6 }, '2026-08-03T10:00:00Z', 'Revendiquer', true],
  [{ lat: 47.465, lng: 6 }, '2026-08-03T10:00:00Z', '✓ Visité le 3 août 2026 · 274 km', false],
] as const)('position %o, visité %s : « %s »', (position, visiteLe, libelle, actif) => {
  position_.mockReturnValue({ position, demander: vi.fn() })
  afficher({ lat: 45, lng: 6, visiteLe })
  const bouton = screen.getByRole('button', { name: libelle })
  if (actif) expect(bouton).toBeEnabled()
  else expect(bouton).toBeDisabled()
})

test('à portée, toucher marque la visite puis ouvre la revendication', async () => {
  position_.mockReturnValue({ position: { lat: 45.0009, lng: 6 }, demander: vi.fn() })
  afficher({ lat: 45, lng: 6, visiteLe: null })
  await userEvent.click(screen.getByRole('button', { name: 'Marquer ma visite (GPS)' }))
  expect(visiter).toHaveBeenCalledWith({ lat: 45.0009, lng: 6 })
  expect(onVisite).toHaveBeenCalled()
})

test('refus du serveur : le message s’écrit sous le bouton, pas de fenêtre', async () => {
  position_.mockReturnValue({ position: { lat: 45.0009, lng: 6 }, demander: vi.fn() })
  visiter.mockRejectedValueOnce(new Error('Trop loin'))
  visite_.mockReturnValue({
    visiter,
    enCours: false,
    erreur: 'Tu es encore trop loin pour marquer ta visite.',
  })
  afficher({ lat: 45, lng: 6, visiteLe: null })
  await userEvent.click(screen.getByRole('button', { name: 'Marquer ma visite (GPS)' }))
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Tu es encore trop loin pour marquer ta visite.',
  )
  expect(onVisite).not.toHaveBeenCalled()
})

test('position refusée : l’aide pour l’autoriser est écrite', () => {
  position_.mockReturnValue({ position: 'refusee', demander: vi.fn() })
  afficher({ lat: 45, lng: 6, visiteLe: null })
  expect(
    screen.getByText('Autorise la localisation dans les réglages du navigateur pour visiter.'),
  ).toBeInTheDocument()
})

test('jamais visité et trop loin : « J’y suis allé » ouvre la feuille du souvenir', async () => {
  position_.mockReturnValue({ position: loin, demander: vi.fn() })
  afficher({ lat: 45, lng: 6, visiteLe: null })
  await userEvent.click(screen.getByRole('button', { name: 'J’y suis allé' }))
  expect(onSouvenir).toHaveBeenCalled()
})

test('le lien s’accorde au genre choisi, et ne s’offre plus à un lieu déjà visité', () => {
  position_.mockReturnValue({ position: loin, demander: vi.fn() })
  afficher({ lat: 45, lng: 6, visiteLe: null, genre: 'f' })
  expect(screen.getByRole('button', { name: 'J’y suis allée' })).toBeInTheDocument()
  afficher({ lat: 45, lng: 6, visiteLe: '2026-08-03T10:00:00Z' })
  expect(screen.queryByRole('button', { name: 'J’y suis allé' })).toBeNull()
})

test('position refusée : le lien seulement sur un lieu jamais visité', () => {
  position_.mockReturnValue({ position: 'refusee', demander: vi.fn() })
  afficher({ lat: 45, lng: 6, visiteLe: null })
  expect(screen.getByRole('button', { name: 'J’y suis allé' })).toBeInTheDocument()
  afficher({ lat: 45, lng: 6, visiteLe: '2019-08-01T10:00:00Z', souvenirLe: '2019-08-01' })
  expect(screen.getAllByRole('button', { name: 'J’y suis allé' })).toHaveLength(1)
})

test('un souvenir : loin le bouton rappelle le mois, sur place on visite (jamais Revendiquer)', () => {
  position_.mockReturnValue({ position: loin, demander: vi.fn() })
  afficher({ lat: 45, lng: 6, visiteLe: '2019-08-01T10:00:00Z', souvenirLe: '2019-08-01' })
  expect(
    screen.getByRole('button', { name: '✓ J’y suis allé en août 2019 · 274 km' }),
  ).toBeDisabled()
  position_.mockReturnValue({ position: { lat: 45.0009, lng: 6 }, demander: vi.fn() })
  afficher({ lat: 45, lng: 6, visiteLe: '2019-08-01T10:00:00Z', souvenirLe: '2019-08-01' })
  expect(screen.getByRole('button', { name: 'Marquer ma visite (GPS)' })).toBeEnabled()
  expect(screen.queryByRole('button', { name: 'Revendiquer' })).toBeNull()
})

test('« Me localiser pour visiter » demande la position', async () => {
  const demander = vi.fn()
  position_.mockReturnValue({ position: 'inconnue', demander })
  afficher({ lat: 45, lng: 6, visiteLe: null })
  await userEvent.click(screen.getByRole('button', { name: 'Me localiser pour visiter' }))
  expect(demander).toHaveBeenCalled()
})
