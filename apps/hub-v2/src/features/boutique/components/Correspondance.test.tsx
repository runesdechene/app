import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import { Correspondance } from './Correspondance'

const api = vi.hoisted(() => ({
  lireCorrespondances: vi.fn(),
  ajouterCorrespondance: vi.fn(),
  retirerCorrespondance: vi.fn(),
  lireFragments: vi.fn(),
  lireAchats: vi.fn(),
}))
vi.mock('../api/correspondance', () => ({
  lireCorrespondances: api.lireCorrespondances,
  ajouterCorrespondance: api.ajouterCorrespondance,
  retirerCorrespondance: api.retirerCorrespondance,
}))
vi.mock('../api/fragments', () => ({ lireFragments: api.lireFragments }))
vi.mock('../api/achats', () => ({ lireAchats: api.lireAchats }))

const fragment = (id: number, name: string) => ({ id, name, illustration_url: `https://cdn/${name}.png`, image_url: null })

beforeEach(() => {
  vi.clearAllMocks()
  api.lireFragments.mockResolvedValue([fragment(7, 'Hoplite'), fragment(8, 'Loup')])
  api.lireCorrespondances.mockResolvedValue([{ id: 1, shopify_tag: 'fragment:loup', unlock_ref_id: 8, created_at: '2026-10-01T10:00:00Z' }])
  api.lireAchats.mockResolvedValue([])
  api.ajouterCorrespondance.mockResolvedValue(undefined)
  api.retirerCorrespondance.mockResolvedValue(undefined)
})

function afficher() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><Correspondance /></MemoryRouter>
    </QueryClientProvider>,
  )
}

test('une ligne dit quelle étiquette débloque quel Fragment', async () => {
  afficher()
  expect(await screen.findByText('fragment:loup')).toBeInTheDocument()
  expect(screen.getAllByText('Loup').length).toBeGreaterThan(0)
})

test('un Fragment sans illustration montre son image de repli', async () => {
  api.lireFragments.mockResolvedValue([{ id: 8, name: 'Loup', illustration_url: null, image_url: 'https://cdn/loup-repli.png' }])
  const { container } = afficher()
  await screen.findByText('fragment:loup')
  await waitFor(() => { expect(container.querySelector('img')).toHaveAttribute('src', 'https://cdn/loup-repli.png') })
})

test('« + Ajouter » attend l’étiquette et le Fragment', async () => {
  afficher()
  await screen.findByText('fragment:loup')
  await screen.findByRole('option', { name: 'Loup' })
  expect(screen.getByRole('button', { name: '+ Ajouter' })).toBeDisabled()
  await userEvent.type(screen.getByLabelText('Étiquette Shopify'), 'fragment:Hoplite')
  expect(screen.getByRole('button', { name: '+ Ajouter' })).toBeDisabled()
  await userEvent.selectOptions(screen.getByLabelText('Fragment'), 'Hoplite')
  expect(screen.getByRole('button', { name: '+ Ajouter' })).toBeEnabled()
})

test('ajoute la correspondance telle que tapée (la normalisation est dans l’api)', async () => {
  afficher()
  await screen.findByText('fragment:loup')
  await screen.findByRole('option', { name: 'Loup' })
  await userEvent.type(screen.getByLabelText('Étiquette Shopify'), 'fragment:Hoplite')
  await userEvent.selectOptions(screen.getByLabelText('Fragment'), 'Hoplite')
  await userEvent.click(screen.getByRole('button', { name: '+ Ajouter' }))
  await waitFor(() => { expect(api.ajouterCorrespondance).toHaveBeenCalledWith('fragment:Hoplite', 7) })
})

test('un doublon dit son message', async () => {
  api.ajouterCorrespondance.mockRejectedValue(new Error('Cette correspondance existe déjà.'))
  afficher()
  await screen.findByText('fragment:loup')
  await screen.findByRole('option', { name: 'Loup' })
  await userEvent.type(screen.getByLabelText('Étiquette Shopify'), 'fragment:loup')
  await userEvent.selectOptions(screen.getByLabelText('Fragment'), 'Loup')
  await userEvent.click(screen.getByRole('button', { name: '+ Ajouter' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Cette correspondance existe déjà.')
})

test('« Retirer » demande confirmation, seul « Confirmer » retire', async () => {
  afficher()
  await userEvent.click(await screen.findByRole('button', { name: 'Retirer' }))
  expect(screen.getByText('Retirer cette correspondance ?')).toBeInTheDocument()
  expect(api.retirerCorrespondance).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
  await waitFor(() => { expect(api.retirerCorrespondance).toHaveBeenCalledWith(1) })
})

test('« Annuler » ne retire rien', async () => {
  afficher()
  await userEvent.click(await screen.findByRole('button', { name: 'Retirer' }))
  await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))
  expect(api.retirerCorrespondance).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Retirer' })).toBeInTheDocument()
})

test('aucune correspondance : on le dit', async () => {
  api.lireCorrespondances.mockResolvedValue([])
  afficher()
  expect(await screen.findByText('Aucune correspondance.')).toBeInTheDocument()
})

test('un retrait qui réussit efface l’erreur de l’ajout précédent', async () => {
  api.ajouterCorrespondance.mockRejectedValue(new Error('Cette correspondance existe déjà.'))
  afficher()
  await screen.findByText('fragment:loup')
  await screen.findByRole('option', { name: 'Loup' })
  await userEvent.type(screen.getByLabelText('Étiquette Shopify'), 'fragment:loup')
  await userEvent.selectOptions(screen.getByLabelText('Fragment'), 'Loup')
  await userEvent.click(screen.getByRole('button', { name: '+ Ajouter' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('existe déjà')
  await userEvent.click(screen.getByRole('button', { name: 'Retirer' }))
  await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
  await waitFor(() => { expect(api.retirerCorrespondance).toHaveBeenCalled() })
  await waitFor(() => { expect(screen.queryByRole('alert')).not.toBeInTheDocument() })
})
