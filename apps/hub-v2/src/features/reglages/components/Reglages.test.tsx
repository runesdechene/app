import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import { Reglages } from './Reglages'

const mockUpsert = vi.hoisted(() => vi.fn())
const mockEnvoyer = vi.hoisted(() => vi.fn())
const mockRetirer = vi.hoisted(() => vi.fn())
vi.mock('@/shared/lib/envoi', async (orig) => ({
  ...(await orig<typeof import('@/shared/lib/envoi')>()), envoyerFichier: mockEnvoyer, retirerFichier: mockRetirer,
}))
vi.mock('@/shared/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({ in: () => Promise.resolve({ data: LIGNES, error: null }) }),
      upsert: mockUpsert,
    }),
  },
}))

const ANCIENNE = 'https://x/storage/v1/object/public/app-assets/landing-image-desktop-1.jpg'
const NOUVELLE = 'https://x/storage/v1/object/public/app-assets/landing-image-desktop-2.png'
const LIGNES = [
  { key: 'share_text_template', value: 'Un trésor t’attend : {name}.', updated_at: '2026-10-12T10:00:00Z' },
  { key: 'landing_image_desktop_url', value: ANCIENNE, updated_at: '2026-10-01T10:00:00Z' },
]

function monter() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><Reglages /></MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUpsert.mockResolvedValue({ error: null })
  mockEnvoyer.mockResolvedValue(NOUVELLE)
  mockRetirer.mockResolvedValue(undefined)
  URL.createObjectURL = vi.fn(() => 'blob:apercu')
  URL.revokeObjectURL = vi.fn()
})

test('l’aperçu remplace {name} par « Abbaye de Fontenay » et la date d’enregistrement se lit', async () => {
  monter()
  const champ = await screen.findByLabelText('La phrase')
  expect(champ).toHaveValue('Un trésor t’attend : {name}.')
  expect(screen.getByText('Abbaye de Fontenay', { selector: 'strong' })).toBeInTheDocument()
  expect(screen.getByText(/Enregistrée le 12\/10\/2026/)).toBeInTheDocument()
  expect(screen.getByText('28 signes')).toBeInTheDocument()
})

test('un texte vide montre la phrase qu’Explore garde', async () => {
  monter()
  await userEvent.clear(await screen.findByLabelText('La phrase'))
  expect(screen.getByText(/sur Runes de Chêne EXPLORE - tu connais \?/)).toBeInTheDocument()
})

test('« Enregistrer » écrit le texte en upsert sur la clé', async () => {
  monter()
  const champ = await screen.findByLabelText('La phrase')
  await userEvent.clear(champ)
  await userEvent.type(champ, 'Viens voir {{name}')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  await waitFor(() => { expect(mockUpsert).toHaveBeenCalledTimes(1) })
  expect(mockUpsert).toHaveBeenCalledWith(
    expect.objectContaining({ key: 'share_text_template', value: 'Viens voir {name}', updated_at: expect.any(String) as string }),
    { onConflict: 'key' },
  )
})

test('l’écran dit que l’image change au prochain passage de la nuit', async () => {
  monter()
  expect(await screen.findByText('Une nouvelle image apparaît au prochain passage de la nuit.')).toBeInTheDocument()
  expect(screen.getByText('runesdechene.com/mouvement')).toBeInTheDocument()
})

test('l’image choisie ne part qu’à l’enregistrement ; l’ancienne est retirée ensuite', async () => {
  monter()
  await screen.findByLabelText('La phrase')
  const fichier = new File(['x'], 'nouvelle.png', { type: 'image/png' })
  await userEvent.upload(screen.getByLabelText('Remplacer l’image'), fichier)
  expect(mockEnvoyer).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer l’image' }))
  await waitFor(() => { expect(mockRetirer).toHaveBeenCalledWith('app-assets', ANCIENNE) })
  expect(mockEnvoyer).toHaveBeenCalledWith('app-assets', expect.stringMatching(/^landing-image-desktop-\d+\.png$/), fichier)
  expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ key: 'landing_image_desktop_url', value: NOUVELLE }), { onConflict: 'key' })
  expect(mockUpsert.mock.invocationCallOrder[0]).toBeLessThan(mockRetirer.mock.invocationCallOrder[0] ?? 0)
})

test('si la base refuse, le nouveau fichier est retiré et l’ancien reste', async () => {
  mockUpsert.mockResolvedValue({ error: { message: 'refusé' } })
  monter()
  await screen.findByLabelText('La phrase')
  await userEvent.upload(screen.getByLabelText('Remplacer l’image'), new File(['x'], 'n.png', { type: 'image/png' }))
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer l’image' }))
  await waitFor(() => { expect(mockRetirer).toHaveBeenCalledWith('app-assets', NOUVELLE) })
  expect(mockRetirer).not.toHaveBeenCalledWith('app-assets', ANCIENNE)
  expect(await screen.findByRole('alert')).toHaveTextContent('refusé')
})

test('sur téléphone, les liens « Parler aux joueurs » viennent avant le texte de partage (R7)', async () => {
  monter()
  const liens = await screen.findByRole('link', { name: /Mises à jour/ })
  expect(screen.getByRole('link', { name: /Notifications/ })).toHaveAttribute('href', '/joueurs/notifications')
  expect(screen.getByRole('link', { name: /Blog de la boutique/ })).toHaveAttribute('href', '/joueurs/blog')
  const partage = await screen.findByRole('heading', { name: 'Le texte de partage' })
  expect(liens.compareDocumentPosition(partage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})
