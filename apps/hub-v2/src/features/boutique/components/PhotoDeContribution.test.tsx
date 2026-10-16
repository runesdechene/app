import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { Contribution, PhotoDeContribution as Photo } from '../api/contributions'
import { PhotoDeContribution } from './PhotoDeContribution'

const api = vi.hoisted(() => ({
  montrerAuMur: vi.fn(), montrerDansCommunaute: vi.fn(), relierProduit: vi.fn(), delierProduit: vi.fn(),
  mettreSurLaFiche: vi.fn(), supprimerPhoto: vi.fn(),
}))
vi.mock('../api/contributions', () => api)
const shopify = vi.hoisted(() => ({ chercherProduits: vi.fn() }))
vi.mock('../api/shopify', () => shopify)

const photo = (surcharge: Partial<Photo> = {}): Photo => ({
  id: 'p1', url: 'https://x/storage/v1/object/public/community-photos/c1/p1.webp', chemin: 'c1/p1.webp', taille: 'M',
  produit_id: null, produit_handle: null, produit_titre: null, media: null, communaute: false, mur: false, ...surcharge,
})
const contribution = { id: 'c1', nom: 'Brune', instagram: null, hauteur: 168, taille: 'M', diffusion: true, images: [] } as Partial<Contribution> as Contribution

// Comme l'écran : une lecture des contributions observée, que l'écriture rafraîchit.
function Lecture({ lire }: { lire: () => Promise<null> }) {
  useQuery({ queryKey: ['hub-contributions', 'liste'], queryFn: lire })
  return null
}

function afficher(p: Photo, lire: () => Promise<null> = () => Promise.resolve(null)) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <Lecture lire={lire} />
      <PhotoDeContribution contribution={contribution} photo={p} rang={0} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  for (const f of Object.values(api)) f.mockResolvedValue(undefined)
})

test('sans produit, « Fiche produit » et « Communauté » sont désactivés et le texte dit pourquoi', async () => {
  afficher(photo())
  expect(screen.getByRole('button', { name: 'Fiche produit' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Communauté' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Communauté' })).toHaveAttribute('title', 'Relie d’abord un produit')
  await waitFor(() => { expect(screen.getByRole('button', { name: 'Mur' })).toBeEnabled() })
})

test('« Mur » appelle montrerAuMur(id, true)', async () => {
  afficher(photo())
  await userEvent.click(screen.getByRole('button', { name: 'Mur' }))
  await waitFor(() => { expect(api.montrerAuMur).toHaveBeenCalledWith('p1', true) })
})

test('« Média » est l’accord de diffusion, en lecture seule', () => {
  afficher(photo())
  const media = screen.getByRole('button', { name: 'Média' })
  expect(media).toHaveAttribute('aria-pressed', 'true')
  expect(media).toBeDisabled()
})

test('relier un produit trouvé par la recherche', async () => {
  const produit = { id: '12', titre: 'Veste Hoplite', handle: 'veste', image: null, prix: '49 €' }
  shopify.chercherProduits.mockResolvedValue([produit])
  afficher(photo())
  await userEvent.click(screen.getByRole('button', { name: 'Relier à un produit' }))
  await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un produit…' }), 'veste')
  await userEvent.click(await screen.findByRole('button', { name: /Veste Hoplite/ }))
  await waitFor(() => { expect(api.relierProduit).toHaveBeenCalledWith('p1', produit) })
})

test('un produit relié : « Relié à … », « Retirer », et les canaux s’ouvrent', async () => {
  afficher(photo({ produit_id: '12', produit_titre: 'Veste Hoplite', media: '99', communaute: true }))
  expect(screen.getByText('Veste Hoplite')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Fiche produit' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Communauté' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Communauté' })).not.toHaveAttribute('title')
  await userEvent.click(screen.getByRole('button', { name: 'Fiche produit' }))
  await waitFor(() => { expect(api.mettreSurLaFiche).toHaveBeenCalledWith(contribution, expect.objectContaining({ id: 'p1' }), false) })
  await userEvent.click(screen.getByRole('button', { name: 'Retirer le produit' }))
  await waitFor(() => { expect(api.delierProduit).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' })) })
})

test('« Télécharger » est un lien qui nomme le fichier', () => {
  afficher(photo())
  const lien = screen.getByRole('link', { name: 'Télécharger' })
  expect(lien).toHaveAttribute('href', 'https://x/storage/v1/object/public/community-photos/c1/p1.webp?download=Brune+-+1.webp')
})

test('supprimer la photo demande confirmation, puis le refus s’affiche sous la photo', async () => {
  api.supprimerPhoto.mockRejectedValue(new Error('Suppression image: HTTP 500'))
  afficher(photo())
  await userEvent.click(screen.getByRole('button', { name: 'Supprimer la photo' }))
  expect(api.supprimerPhoto).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Suppression image: HTTP 500')
  expect(api.supprimerPhoto).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }))
})

test('un second clic avant que la liste soit relue ne repousse pas l’image', async () => {
  let relue: () => void = () => undefined
  let lectures = 0
  const lire = () => {
    lectures += 1
    return lectures === 1 ? Promise.resolve(null) : new Promise<null>((fin) => { relue = () => { fin(null) } })
  }
  afficher(photo({ produit_id: '12' }), lire)
  const fiche = screen.getByRole('button', { name: 'Fiche produit' })
  await waitFor(() => { expect(fiche).toBeEnabled() })
  await userEvent.click(fiche)
  await waitFor(() => { expect(api.mettreSurLaFiche).toHaveBeenCalledOnce() })
  // L'écriture est partie, la relecture est en cours : la case reste fermée.
  await waitFor(() => { expect(lectures).toBe(2) })
  await waitFor(() => { expect(fiche).toBeDisabled() })
  await userEvent.click(fiche)
  expect(api.mettreSurLaFiche).toHaveBeenCalledOnce()
  relue()
  await waitFor(() => { expect(fiche).toBeEnabled() })
})
