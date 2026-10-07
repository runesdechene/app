/**
 * QUOI     — gérer une Compagnie : le Chef nomme les rôles et passe la main, un officier non ; les
 *            demandes s'acceptent ; on nomme un officier.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import type { FicheCompagnie } from '../api/lireCompagnies'
import { GererCompagnie } from './GererCompagnie'

const api = vi.hoisted(() => ({
  fetchCompagnie: vi.fn(),
  modifier: vi.fn(() => Promise.resolve()),
  repondre: vi.fn(() => Promise.resolve()),
  changerRole: vi.fn(() => Promise.resolve()),
  retirer: vi.fn(() => Promise.resolve()),
  envoyerAvatar: vi.fn(),
  rejoindre: vi.fn(),
  quitter: vi.fn(),
}))
vi.mock('../api/compagnies', () => api)

const FICHE: FicheCompagnie = {
  id: 'f-lys',
  nom: 'Le Lys de Fer',
  devise: 'Les forteresses de l’Est.',
  mission: 'Arpenter.',
  couleur: '#5f6f86',
  avatar: null,
  privee: true,
  fondeeLe: '2026-06-12T10:00:00Z',
  roles: {
    chefM: 'Seigneur au Lys',
    chefF: 'Dame au Lys',
    officierM: 'Paladin',
    officierF: 'Paladine',
  },
  monRole: 'chef',
  demandee: false,
  nbMembres: 2,
  membres: [
    { id: 'u1', nom: 'Uriel', avatar: null, role: 'chef', genre: 'm' },
    { id: 'u3', nom: 'Rémy', avatar: null, role: 'membre', genre: 'm' },
  ],
  lieux: [],
  demandes: [
    {
      id: 'u9',
      nom: 'Margaux',
      avatar: null,
      mot: 'Je connais Joux',
      quand: '2026-10-05T08:00:00Z',
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
})

function monter(fiche: FicheCompagnie) {
  api.fetchCompagnie.mockResolvedValue(fiche)
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <GererCompagnie id="f-lys" />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('le Chef renomme les rôles et enregistre la fiche', async () => {
  monter(FICHE)
  const chefF = await screen.findByRole('textbox', { name: 'Le Chef, au féminin' })
  await userEvent.clear(chefF)
  await userEvent.type(chefF, 'Grande Dame')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(api.modifier).toHaveBeenCalledWith(
    'f-lys',
    expect.objectContaining({ nom: 'Le Lys de Fer', chefF: 'Grande Dame', privee: true }),
  )
})

test('une demande s’accepte ; un membre devient officier', async () => {
  monter(FICHE)
  const demande = (await screen.findByText('Margaux')).closest('li')
  if (!demande) throw new Error('demande absente')
  await userEvent.click(within(demande).getByRole('button', { name: 'Accepter' }))
  expect(api.repondre).toHaveBeenCalledWith('f-lys', 'u9', true)
  await userEvent.click(screen.getByRole('button', { name: 'Nommer Paladin / Paladine : Rémy' }))
  expect(api.changerRole).toHaveBeenCalledWith('f-lys', 'u3', 'officier')
})

test('passer la main à un autre Chef', async () => {
  monter(FICHE)
  await userEvent.click(
    await screen.findByRole('button', { name: 'Passer la main à un autre Chef…' }),
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Confier la Compagnie à Rémy' }))
  expect(api.changerRole).toHaveBeenCalledWith('f-lys', 'u3', 'chef')
})

test('un officier ne nomme pas les rôles et ne passe pas la main', async () => {
  monter({ ...FICHE, monRole: 'officier' })
  await screen.findByRole('textbox', { name: 'Son nom' })
  expect(screen.queryByRole('textbox', { name: 'Le Chef, au féminin' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Passer la main/ })).not.toBeInTheDocument()
})
