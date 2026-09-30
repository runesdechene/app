import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import { FicheLieu } from './FicheLieu'

const api = vi.hoisted(() => ({
  fetchFiche: vi.fn(),
  basculerEnvie: vi.fn(() => Promise.resolve(true)),
  fetchMoi: vi.fn(),
  fetchCoeurs: vi.fn(),
  aimerLieu: vi.fn(() => Promise.resolve()),
  fetchCarnet: vi.fn(() => Promise.resolve({ total: 0, mots: [] })),
  ecrireAuCarnet: vi.fn(),
  basculerCoeurMot: vi.fn(),
  effacerMot: vi.fn(),
}))
vi.mock('../api/lieu', () => api)

const FICHE = {
  id: 'a',
  nom: 'Château de Jonjeac',
  recit: 'Un récit.',
  adresse: 'Jonjeac',
  lat: 45.9,
  lng: 6.1,
  photos: [
    { url: 'u1', vignette: 'v1' },
    { url: 'u2', vignette: 'v2' },
  ],
  type: { nom: 'Château et fortins', icone: null, couleur: '#9b3f39' },
  faits: { epoque: 'Moyen Âge', annee: 1150, saison: null, acces: null, bivouac: null },
  explorateurs: { nombre: 3, derniers: [] },
  revendication: { nom: 'LES LOUPS', moi: false, depuis: '2026-09-12T10:00:00Z' },
  auteur: { id: 'l', nom: 'Luna', avatar: null },
  ajouteLe: '2026-01-01T00:00:00Z',
  ajoutADistance: false,
  enrichiPar: { id: 'm', nom: 'Mathéo' },
  moi: { visiteLe: null, envie: false },
}

const COEURS = {
  total: 42,
  miens: 0,
  gens: [
    { id: 'k', nom: 'Kelpie', avatar: null, nombre: 30 },
    { id: 'x', nom: 'Aelis', avatar: null, nombre: 12 },
  ],
}

beforeEach(() => {
  api.fetchFiche.mockResolvedValue(FICHE)
  api.fetchMoi.mockResolvedValue({ id: 'moi', admin: false })
  api.fetchCoeurs.mockResolvedValue(COEURS)
})

const onCoeurs = vi.fn()

function afficher() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <FicheLieu
          id="a"
          onOptions={vi.fn()}
          onPartager={vi.fn()}
          onCoeurs={onCoeurs}
          boutonVisite={() => <span>bouton</span>}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('la fiche montre le lieu tel que maquetté', async () => {
  afficher()
  expect(await screen.findByRole('heading', { name: 'Château de Jonjeac' })).toBeInTheDocument()
  expect(screen.getByText('Château et fortins')).toBeInTheDocument()
  expect(screen.getByText('Moyen Âge · XIIᵉ siècle')).toBeInTheDocument()
  expect(screen.getByText('3 Explorateurs ont foulé ce lieu')).toBeInTheDocument()
  expect(screen.getByText('LES LOUPS')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Jonjeac/ })).toHaveAttribute(
    'href',
    expect.stringContaining('45.9,6.1'),
  )
  expect(screen.getByText(/Enrichi par/)).toBeInTheDocument()
})

test('ajouté sur place, le crédit est plein ; à distance, il le dit et se fait discret', async () => {
  afficher()
  const credit = await screen.findByText(/Lieu ajouté par/)
  expect(credit.closest('p')).not.toHaveAttribute('data-distance')

  cleanup()
  api.fetchFiche.mockResolvedValue({ ...FICHE, ajoutADistance: true })
  afficher()
  const distant = await screen.findByText(/Lieu ajouté à distance par/)
  expect(distant).toHaveTextContent('Lieu ajouté à distance par Luna')
  expect(distant.closest('p')).toHaveAttribute('data-distance')
})

test('« Envie d’y aller » bascule tout de suite', async () => {
  afficher()
  const signet = await screen.findByRole('button', { name: 'Envie d’y aller' })
  expect(signet).toHaveAttribute('aria-pressed', 'false')
  await userEvent.click(signet)
  expect(signet).toHaveAttribute('aria-pressed', 'true')
  expect(api.basculerEnvie).toHaveBeenCalledWith('a')
})

test('un lieu nu n’affiche aucune ligne vide', async () => {
  api.fetchFiche.mockResolvedValue({
    ...FICHE,
    photos: [],
    type: null,
    revendication: null,
    enrichiPar: null,
    faits: { epoque: null, annee: null, saison: null, acces: null, bivouac: null },
    explorateurs: { nombre: 0, derniers: [] },
  })
  afficher()
  expect(await screen.findByText('Personne n’a encore foulé ce lieu')).toBeInTheDocument()
  expect(screen.queryByText(/Revendiqué par/)).toBeNull()
  expect(screen.queryByText(/siècle/)).toBeNull()
})

test('un lieu introuvable le dit', async () => {
  api.fetchFiche.mockResolvedValue(null)
  afficher()
  expect(await screen.findByText('Ce lieu n’existe pas ou n’est plus visible')).toBeInTheDocument()
})

test('si la base refuse l’envie, le signet revient et le dit', async () => {
  api.basculerEnvie.mockRejectedValueOnce(new Error('réseau'))
  afficher()
  const signet = await screen.findByRole('button', { name: 'Envie d’y aller' })
  await userEvent.click(signet)
  expect(await screen.findByRole('alert')).toHaveTextContent('L’envie n’a pas pu être enregistrée')
  expect(signet).toHaveAttribute('aria-pressed', 'false')
})

test('aimer un lieu : à volonté, chaque toucher envoie un cœur qui s’envole', async () => {
  afficher()
  const coeur = await screen.findByRole('button', { name: 'Envoyer un cœur (42)' })
  // La base, après la rafale : deux cœurs de plus, les miens.
  api.fetchCoeurs.mockResolvedValue({ ...COEURS, total: 44, miens: 2 })
  await userEvent.click(coeur)
  await userEvent.click(coeur)
  expect(api.aimerLieu).toHaveBeenCalledTimes(2)
  expect(await screen.findByRole('button', { name: 'Envoyer un cœur (44)' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(coeur.querySelectorAll('[data-envol]').length).toBeGreaterThan(0)
})

test('sous les crédits : féliciter ceux qui ont fait le lieu, et voir qui a envoyé des cœurs', async () => {
  afficher()
  const feliciter = await screen.findByRole('button', { name: /Féliciter Luna et Mathéo/ })
  await userEvent.click(feliciter)
  expect(api.aimerLieu).toHaveBeenCalledWith('a')
  await userEvent.click(
    screen.getByRole('button', { name: /Kelpie et Aelis ont envoyé 4\d cœurs/ }),
  )
  expect(onCoeurs).toHaveBeenCalled()
})

test('sur son propre lieu, on lit ses cœurs sans pouvoir s’en envoyer', async () => {
  api.fetchMoi.mockResolvedValue({ id: 'l', admin: false })
  afficher()
  const pastille = await screen.findByRole('button', { name: 'Voir les cœurs (42)' })
  await userEvent.click(pastille)
  expect(onCoeurs).toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: /Féliciter/ })).not.toBeInTheDocument()
  expect(api.aimerLieu).not.toHaveBeenCalled()
  expect(within(pastille).getByText('42')).toBeInTheDocument()
})
