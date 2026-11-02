/**
 * QUOI     — les collections du Codex au Hub : une ligne par collection des Fragments, sa couleur,
 *            son icône, son titre.
 * POURQUOI — l'appli les montre au Codex (maquette F, 02/11) ; elles ne vivent pas dans Shopify.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Collections } from './Collections'

const api = vi.hoisted(() => ({
  lireCollections: vi.fn(),
  ecrireCollection: vi.fn(),
}))
vi.mock('../api/collections', () => api)

function afficher(heritages: (string | null)[]) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Collections heritages={heritages} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  api.lireCollections.mockResolvedValue([{ heritage: 'Le Pacte Sauvage', couleur: '#406b45', icone_url: null, titre: 'Gardien du Pacte' }])
  api.ecrireCollection.mockResolvedValue(undefined)
})

test('une ligne par collection, une seule fois, sans le vide', async () => {
  afficher(['Le Pacte Sauvage', 'Les mystères celtes', 'Le Pacte Sauvage', '', null])
  expect(await screen.findByRole('group', { name: 'Le Pacte Sauvage' })).toBeInTheDocument()
  expect(screen.getByRole('group', { name: 'Les mystères celtes' })).toBeInTheDocument()
  expect(screen.getAllByRole('group')).toHaveLength(2)
})

test('enregistrer une collection écrit sa couleur et son titre', async () => {
  afficher(['Les mystères celtes'])
  const ligne = await screen.findByRole('group', { name: 'Les mystères celtes' })
  await userEvent.type(within(ligne).getByLabelText('Couleur'), '#3b5485')
  await userEvent.type(within(ligne).getByLabelText('Titre de la collection complète'), 'Initié du Nemeton')
  await userEvent.click(within(ligne).getByRole('button', { name: 'Enregistrer' }))
  expect(api.ecrireCollection).toHaveBeenCalledWith({
    heritage: 'Les mystères celtes',
    couleur: '#3b5485',
    icone_url: '',
    titre: 'Initié du Nemeton',
  })
})

test('une couleur mal écrite est refusée avant l’envoi', async () => {
  afficher(['Les mystères celtes'])
  const ligne = await screen.findByRole('group', { name: 'Les mystères celtes' })
  await userEvent.type(within(ligne).getByLabelText('Couleur'), 'bleu')
  await userEvent.click(within(ligne).getByRole('button', { name: 'Enregistrer' }))
  expect(within(ligne).getByRole('alert')).toHaveTextContent('La couleur s’écrit #RRGGBB.')
  expect(api.ecrireCollection).not.toHaveBeenCalled()
})
