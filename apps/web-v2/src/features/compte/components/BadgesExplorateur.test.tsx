/**
 * QUOI     — les badges à droite du titre : « Client Runes de Chêne » s'explique au toucher, le rôle
 *            s'affiche, rien pour un profil sans badge.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { ExplorateurProfile } from '../api/lireProfil'
import { BadgesExplorateur } from './BadgesExplorateur'

const fetchExplorateur = vi.hoisted(() =>
  vi.fn<(id: string) => Promise<ExplorateurProfile | null>>(),
)
vi.mock('../api/explorateur', () => ({ fetchExplorateur }))

const BASE: ExplorateurProfile = {
  id: 'u1',
  nom: 'Uriel',
  avatarUrl: null,
  niveau: 12,
  titres: [],
  bio: null,
  instagram: null,
  inscritLe: '2024-09-30T10:00:00+00:00',
  porteurVerifie: true,
  role: 'admin',
  attache: null,
  fragments: [],
  ajoutes: [],
  nbVisites: 0,
  envies: [],
  signe: null,
  fragmentsADecouvrir: null,
  compagnies: [],
  estMoi: true,
}

function afficher(profil: ExplorateurProfile) {
  fetchExplorateur.mockResolvedValue(profil)
  render(
    <QueryClientProvider client={new QueryClient()}>
      <BadgesExplorateur id="u1" />
    </QueryClientProvider>,
  )
}

test('« Client Runes de Chêne » s’explique au toucher', async () => {
  afficher(BASE)
  await userEvent.click(await screen.findByRole('button', { name: /Client Runes de Chêne/ }))
  expect(screen.getByRole('dialog', { name: 'Client Runes de Chêne' })).toHaveTextContent('client')
})

test('le rôle s’affiche', async () => {
  afficher(BASE)
  expect(await screen.findByText('Admin')).toBeInTheDocument()
})

test('ni client ni rôle : aucun badge', async () => {
  afficher({ ...BASE, porteurVerifie: false, role: null })
  await vi.waitFor(() => {
    expect(fetchExplorateur).toHaveBeenCalled()
  })
  expect(screen.queryByRole('button', { name: /Client Runes de Chêne/ })).toBeNull()
  expect(screen.queryByText('Admin')).toBeNull()
})
