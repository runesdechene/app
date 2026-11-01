/**
 * QUOI     — les territoires : le blason (qui le tient, ses compagnons, son nom), la carte qu'il
 *            ouvre (« Renommer » sur le mien), et « Renommer » qui envoie le nom nettoyé.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, test, vi } from 'vitest'
import type { TerritoireRevendique } from '../api/lireCarte'
import { Blason } from './Blason'
import { CarteDExplorateur } from './CarteExplorateur'
import { FeuilleRenommer } from './FeuilleRenommer'

const api = vi.hoisted(() => ({ renommerTerritoire: vi.fn(() => Promise.resolve()) }))
vi.mock('../api/carte', () => api)

const uriel = { id: 'u1', nom: 'Uriel', avatar: null, niveau: 23, titre: null, signe: null }

const territoire: TerritoireRevendique = {
  id: 'lieu-1',
  nom: 'La Garde du Comté',
  moi: true,
  lieux: 5,
  ids: ['lieu-1', 'lieu-2'],
  morceaux: [],
  ancre: [7.27, 43.7],
  compagnons: 2,
  joueur: uriel,
}

function avecRouteur(element: React.ReactElement) {
  const router = createMemoryRouter(
    [
      { path: '/carte', element },
      { path: '*', element: null },
    ],
    { initialEntries: ['/carte'] },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

test('le blason dit le territoire et qui le tient, avec ses compagnons', async () => {
  const toucher = vi.fn()
  render(<Blason territoire={territoire} onToucher={toucher} />)
  const blason = screen.getByRole('button', { name: 'La Garde du Comté, territoire de Uriel' })
  expect(blason).toHaveTextContent('+2')
  expect(blason).toHaveTextContent('La Garde du Comté')
  await userEvent.click(blason)
  expect(toucher).toHaveBeenCalled()
})

test('ma carte, ouverte par mon blason, dit ce que je tiens et propose « Renommer »', async () => {
  const renommer = vi.fn()
  avecRouteur(
    <CarteDExplorateur
      explorateur={uriel}
      etat={{ texte: 'Tient La Garde du Comté · 5 lieux', ton: 'mien' }}
      onFermer={vi.fn()}
      onRenommer={renommer}
    />,
  )
  const carte = await screen.findByRole('dialog', { name: 'Uriel' })
  expect(carte).toHaveTextContent('Tient La Garde du Comté · 5 lieux')
  expect(within(carte).getByRole('button', { name: 'Voir mon profil' })).toBeInTheDocument()
  expect(within(carte).queryByRole('button', { name: 'Envoyer un murmure' })).toBeNull()
  await userEvent.click(within(carte).getByRole('button', { name: 'Renommer' }))
  expect(renommer).toHaveBeenCalled()
})

test('« Renommer » envoie le nom sans ses espaces, puis se referme', async () => {
  const fermer = vi.fn()
  avecRouteur(<FeuilleRenommer territoire={territoire} onFermer={fermer} />)
  const feuille = await screen.findByRole('dialog', { name: 'La Garde du Comté' })
  const champ = within(feuille).getByLabelText('Nom du territoire')
  await userEvent.clear(champ)
  await userEvent.type(champ, '  Les Marches du Nord ')
  await userEvent.click(within(feuille).getByRole('button', { name: 'Renommer' }))
  expect(api.renommerTerritoire).toHaveBeenCalledWith('lieu-1', 'Les Marches du Nord')
  await vi.waitFor(() => {
    expect(fermer).toHaveBeenCalled()
  })
})
