/**
 * QUOI     — « Sur la fiche produit » : la préhistoire, le mot de l'artiste et l'édition d'un motif,
 *            écrits au Hub et enregistrés dans Shopify, puis resynchronisés.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { Fragment } from '../api/fragments'
import { ContenuDuMotif } from './ContenuDuMotif'

const api = vi.hoisted(() => ({ ecrireContenuMotif: vi.fn(), resynchroniser: vi.fn() }))
vi.mock('../api/contenuMotif', () => ({ ecrireContenuMotif: api.ecrireContenuMotif }))
vi.mock('../api/fragments', () => ({ resynchroniser: api.resynchroniser }))

const hoplite = {
  id: 11,
  name: 'Hoplite',
  shopify_handle: 'hoplite',
  resume: 'Ils tenaient la ligne.',
  mot_artiste: null,
  edition: null,
  edition_precision: null,
} as Pick<Fragment, 'id' | 'name' | 'shopify_handle' | 'resume' | 'mot_artiste' | 'edition' | 'edition_precision'>

function afficher(f = hoplite) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ContenuDuMotif fragment={f} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  api.ecrireContenuMotif.mockResolvedValue(undefined)
  api.resynchroniser.mockResolvedValue(1)
})

test('écrire le mot de l’artiste et l’édition, puis resynchroniser', async () => {
  afficher()
  expect(screen.getByLabelText('En bref (la préhistoire)')).toHaveValue('Ils tenaient la ligne.')
  await userEvent.type(screen.getByLabelText('Le mot de l’artiste'), 'Deux soirées pour le bouclier.')
  await userEvent.selectOptions(screen.getByLabelText('Édition'), 'exclusif')
  await userEvent.type(screen.getByLabelText('Précision de l’édition'), 'Yggdrasil')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer dans Shopify' }))
  expect(api.ecrireContenuMotif).toHaveBeenCalledWith('hoplite', {
    resume: 'Ils tenaient la ligne.',
    mot_de_l_artiste: 'Deux soirées pour le bouclier.',
    edition: 'exclusif',
    edition_precision: 'Yggdrasil',
  })
  await vi.waitFor(() => {
    expect(api.resynchroniser).toHaveBeenCalled()
  })
  expect(await screen.findByRole('status')).toHaveTextContent('Enregistré dans Shopify.')
})

test('sans fiche Shopify reliée, rien ne s’écrit', () => {
  afficher({ ...hoplite, shopify_handle: null })
  expect(screen.getByRole('button', { name: 'Enregistrer dans Shopify' })).toBeDisabled()
})
