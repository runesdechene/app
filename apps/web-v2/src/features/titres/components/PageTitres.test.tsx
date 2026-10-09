/**
 * QUOI     — le panneau « Tous les titres » : un bloc par chemin, le prochain avec sa barre, les
 *            titres portés, « D'une autre époque » ; un titre touché s'explique dans une feuille.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import type { MesTitres } from '../api/lireMesTitres'
import { PageTitres } from './PageTitres'

const api = vi.hoisted(() => ({ fetchMesTitres: vi.fn() }))
vi.mock('../api/mesTitres', () => api)

const titres: MesTitres = {
  obtenus: 3,
  total: 9,
  chemins: [
    {
      stat: 'places_visited',
      compteur: 60,
      titres: [
        { id: 1, nom: 'Pèlerin', min: 10, obtenu: true, porte: false },
        { id: 2, nom: 'Cheminant', min: 50, obtenu: true, porte: true },
        { id: 3, nom: 'Errant', min: 150, obtenu: false, porte: false },
        { id: 4, nom: 'Marcheur des Mondes', min: 500, obtenu: false, porte: false },
      ],
    },
    {
      stat: 'places_enriched',
      compteur: 0,
      titres: [{ id: 5, nom: 'Glaneur', min: 1, obtenu: false, porte: false }],
    },
  ],
}

beforeEach(() => {
  api.fetchMesTitres.mockResolvedValue(titres)
})

function afficher() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <PageTitres />
    </QueryClientProvider>,
  )
}

test('le compte, un bloc par chemin, le prochain avec sa barre', async () => {
  afficher()
  expect(await screen.findByText('3')).toBeInTheDocument()
  expect(screen.getByText('titres obtenus sur 9')).toBeInTheDocument()
  const visites = screen.getByRole('region', { name: 'Les visites' })
  expect(within(visites).getByText('60 lieux visités')).toBeInTheDocument()
  expect(within(visites).getByRole('progressbar', { name: 'Errant' })).toHaveAttribute(
    'aria-valuenow',
    '60',
  )
  expect(within(visites).getAllByRole('progressbar')).toHaveLength(1)
  expect(within(visites).getByRole('button', { name: /Cheminant/ })).toHaveTextContent(
    'sur ton profil',
  )
  expect(screen.getByRole('region', { name: 'Les lieux enrichis' })).toBeInTheDocument()
})

test('un titre obtenu s’explique', async () => {
  afficher()
  await userEvent.click(await screen.findByRole('button', { name: /Cheminant/ }))
  const feuille = screen.getByRole('dialog', { name: 'Cheminant' })
  expect(within(feuille).getByText('Débloqué en visitant 50 lieux sur place.')).toBeInTheDocument()
  expect(within(feuille).getByText('Aujourd’hui : 60 lieux visités.')).toBeInTheDocument()
})

test('un titre à gagner montre où on en est', async () => {
  afficher()
  await userEvent.click(await screen.findByRole('button', { name: /Errant/ }))
  const feuille = screen.getByRole('dialog', { name: 'Errant' })
  expect(within(feuille).getByText('Se gagne en visitant 150 lieux sur place.')).toBeInTheDocument()
  expect(within(feuille).getByText('60 / 150 — encore 90')).toBeInTheDocument()
})

test('une erreur se dit, et se réessaie', async () => {
  api.fetchMesTitres.mockRejectedValue(new Error('réseau'))
  afficher()
  expect(await screen.findByText('Tes titres n’ont pas pu être chargés')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
})

test('un lecteur d’écran entend ce qui est obtenu et ce qui reste à gagner', async () => {
  afficher()
  const visites = await screen.findByRole('region', { name: 'Les visites' })
  expect(within(visites).getByRole('button', { name: /Cheminant.*obtenu/ })).toBeInTheDocument()
  expect(within(visites).getByRole('button', { name: /Errant.*à gagner/ })).toBeInTheDocument()
})

test('le niveau se dit en niveau, pas en nombre', async () => {
  api.fetchMesTitres.mockResolvedValue({
    ...titres,
    chemins: [
      {
        stat: 'level',
        compteur: 12,
        titres: [{ id: 7, nom: 'Compagnon', min: 5, obtenu: true, porte: false }],
      },
    ],
  })
  afficher()
  await userEvent.click(await screen.findByRole('button', { name: /Compagnon/ }))
  const feuille = screen.getByRole('dialog', { name: 'Compagnon' })
  expect(within(feuille).getByText('Aujourd’hui : niveau 12.')).toBeInTheDocument()
})

test('plus de bloc « D’une autre époque », même si la base en envoie encore un', async () => {
  api.fetchMesTitres.mockResolvedValue({
    ...titres,
    autreEpoque: [{ id: 9, nom: 'Banneret', condition: null, porte: false }],
  })
  afficher()
  await screen.findByRole('region', { name: 'Les visites' })
  expect(screen.queryByRole('region', { name: 'D’une autre époque' })).toBeNull()
  expect(screen.queryByRole('button', { name: /Banneret/ })).toBeNull()
})
