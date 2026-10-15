import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { MisesAJour } from './MisesAJour'
import { TiroirMiseAJour } from './TiroirMiseAJour'

const mockRpc = vi.hoisted(() => vi.fn())
const mockEnvoyer = vi.hoisted(() => vi.fn())
const mockRetirer = vi.hoisted(() => vi.fn())
vi.mock('@/shared/lib/envoi', async (orig) => ({
  ...(await orig<typeof import('@/shared/lib/envoi')>()), envoyerFichier: mockEnvoyer, retirerFichier: mockRetirer,
}))
vi.mock('@/shared/supabase/client', () => ({ supabase: { rpc: mockRpc } }))

const ANCIENNE = 'https://x/storage/v1/object/public/announcement-covers/mise-a-jour-1.png'
const NOUVELLE = 'https://x/storage/v1/object/public/announcement-covers/mise-a-jour-2.png'
const carte = {
  id: 4, titre: 'Filtrer la carte', texte: 'Un filtre.\n\nEt un autre.', quand: '2026-10-14T10:00:00Z', image: ANCIENNE,
  version: 'Pythéas 1.2.4', coeurs: 3, miens: 1, mots: 1, aMoi: false, lue: true,
}

// `liste` est ce que lit mises_a_jour_publiees ; supprimer la vide, comme la base.
function monter(adresse: string, echecRpc: string | null = null) {
  let liste = [carte]
  mockRpc.mockImplementation((nom: string) => {
    if (nom === 'mises_a_jour_publiees') return Promise.resolve({ data: liste, error: null })
    if (echecRpc) return Promise.resolve({ data: null, error: { message: echecRpc } })
    if (nom === 'supprimer_mise_a_jour') liste = []
    return Promise.resolve({ data: nom === 'publier_mise_a_jour' ? { id: 5 } : { ok: true }, error: null })
  })
  mockEnvoyer.mockResolvedValue(NOUVELLE)
  mockRetirer.mockResolvedValue(undefined)
  const router = createMemoryRouter([
    { path: '/joueurs/mises-a-jour', Component: MisesAJour, children: [{ path: 'nouvelle', Component: TiroirMiseAJour }, { path: ':id', Component: TiroirMiseAJour }] },
  ], { initialEntries: [adresse] })
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>)
  return router
}

// Taper 3000 signes un à un est lent : on pose la valeur d'un coup.
function poser(champ: HTMLElement, valeur: string) {
  const proto = champ instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(champ, valeur)
  champ.dispatchEvent(new Event('input', { bubbles: true }))
}

beforeEach(() => { vi.clearAllMocks() })

test('la liste montre titre, date, version et « 3 cœurs · 1 mot »', async () => {
  monter('/joueurs/mises-a-jour?q=x')
  const ligne = await screen.findByRole('link', { name: /Filtrer la carte/ })
  expect(ligne).toHaveAttribute('href', '/joueurs/mises-a-jour/4?q=x')
  expect(ligne).toHaveTextContent('14/10/2026')
  expect(ligne).toHaveTextContent('Pythéas 1.2.4')
  expect(ligne).toHaveTextContent('3 cœurs · 1 mot')
})

test('une nouvelle note : le bouton reste inactif tant que titre et texte ne sont pas valides ; compteur « n / 3000 »', async () => {
  monter('/joueurs/mises-a-jour/nouvelle')
  const bouton = await screen.findByRole('button', { name: 'Publier et prévenir les joueurs' })
  expect(bouton).toBeDisabled()
  expect(screen.getByText('0 / 3000')).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Titre'), '   ')
  await userEvent.type(screen.getByLabelText('Texte'), 'Bonjour')
  expect(bouton).toBeDisabled()
  expect(screen.getByText('7 / 3000')).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Titre'), 'Salut')
  expect(bouton).toBeEnabled()
  await userEvent.click(bouton)
  await vi.waitFor(() => { expect(mockRpc).toHaveBeenCalledWith('publier_mise_a_jour', { p_titre: 'Salut', p_texte: 'Bonjour' }) })
})

test('au-delà de 80 signes de titre ou 3000 de texte, le bouton reste inactif', async () => {
  monter('/joueurs/mises-a-jour/nouvelle')
  const bouton = await screen.findByRole('button', { name: 'Publier et prévenir les joueurs' })
  await userEvent.type(screen.getByLabelText('Texte'), 'a')
  poser(screen.getByLabelText('Titre'), 'x'.repeat(81))
  expect(bouton).toBeDisabled()
  poser(screen.getByLabelText('Titre'), 'x'.repeat(80))
  expect(bouton).toBeEnabled()
  poser(screen.getByLabelText('Texte'), 'y'.repeat(3001))
  expect(bouton).toBeDisabled()
})

test('une note existante : « Enregistrer », la fiche est préremplie', async () => {
  monter('/joueurs/mises-a-jour/4')
  expect(await screen.findByRole('button', { name: 'Enregistrer' })).toBeEnabled()
  expect(screen.getByLabelText('Titre')).toHaveValue('Filtrer la carte')
  expect(screen.getByLabelText('Version')).toHaveValue('Pythéas 1.2.4')
})

test('remplacer l’image : l’ancienne est retirée après modifier_mise_a_jour réussie', async () => {
  monter('/joueurs/mises-a-jour/4')
  await userEvent.upload(await screen.findByLabelText('Changer l’image'), new File(['x'], 'a.png', { type: 'image/png' }))
  await vi.waitFor(() => { expect(mockEnvoyer).toHaveBeenCalledWith('announcement-covers', expect.stringMatching(/^mise-a-jour-\d+\.png$/), expect.any(File)) })
  expect(mockRetirer).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  await vi.waitFor(() => { expect(mockRetirer).toHaveBeenCalledWith('announcement-covers', ANCIENNE) })
  expect(mockRpc).toHaveBeenCalledWith('modifier_mise_a_jour', {
    p_id: 4, p_titre: 'Filtrer la carte', p_texte: 'Un filtre.\n\nEt un autre.', p_image: NOUVELLE, p_version: 'Pythéas 1.2.4',
  })
  const appelModifier = mockRpc.mock.calls.findIndex(([nom]) => nom === 'modifier_mise_a_jour')
  expect(mockRpc.mock.invocationCallOrder[appelModifier]).toBeLessThan(mockRetirer.mock.invocationCallOrder[0] ?? 0)
})

test('un fichier refusé n’est pas envoyé', async () => {
  monter('/joueurs/mises-a-jour/4')
  await userEvent.setup({ applyAccept: false }).upload(await screen.findByLabelText('Changer l’image'), new File(['x'], 'a.svg', { type: 'image/svg+xml' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Ce type de fichier n’est pas accepté')
  expect(mockEnvoyer).not.toHaveBeenCalled()
})

test('supprimer : confirmation en ligne, la note part, puis son image', async () => {
  const router = monter('/joueurs/mises-a-jour/4?q=x')
  await userEvent.click(await screen.findByRole('button', { name: 'Supprimer' }))
  expect(screen.getByText(/Supprimer cette mise à jour \?/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
  await vi.waitFor(() => { expect(mockRetirer).toHaveBeenCalledWith('announcement-covers', ANCIENNE) })
  expect(mockRpc).toHaveBeenCalledWith('supprimer_mise_a_jour', { p_id: 4 })
  await vi.waitFor(() => { expect(router.state.location.pathname + router.state.location.search).toBe('/joueurs/mises-a-jour?q=x') })
})

test('supprimer : si le retrait de l’image échoue, la note a quitté la liste et l’erreur s’affiche', async () => {
  monter('/joueurs/mises-a-jour/4')
  mockRetirer.mockRejectedValue(new Error('droits ?'))
  await userEvent.click(await screen.findByRole('button', { name: 'Supprimer' }))
  await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('droits ?')
  await vi.waitFor(() => { expect(screen.queryByRole('link', { name: /Filtrer la carte/ })).not.toBeInTheDocument() })
})

test('annuler la suppression ne supprime rien', async () => {
  monter('/joueurs/mises-a-jour/4')
  await userEvent.click(await screen.findByRole('button', { name: 'Supprimer' }))
  await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))
  expect(mockRpc).not.toHaveBeenCalledWith('supprimer_mise_a_jour', expect.anything())
})

test('une erreur de la base s’affiche sous le formulaire', async () => {
  monter('/joueurs/mises-a-jour/4', 'Réservé aux admins')
  await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Réservé aux admins')
  expect(mockRetirer).not.toHaveBeenCalled()
})
