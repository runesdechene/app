/**
 * QUOI     — le profil public : le sien (« Modifier mon profil »), celui d'un autre (« Envoyer un
 *            murmure »), des envies masquées, un Explorateur introuvable.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import type { ExplorateurProfile } from '../api/lireProfil'
import { ProfilExplorateur } from './ProfilExplorateur'

const fetchExplorateur = vi.hoisted(() =>
  vi.fn<(id: string) => Promise<ExplorateurProfile | null>>(),
)
vi.mock('../api/explorateur', () => ({ fetchExplorateur }))
const choisirSigne = vi.hoisted(() => vi.fn(() => Promise.resolve()))
vi.mock('../api/monProfil', () => ({ choisirSigne }))
const position = vi.hoisted(() =>
  vi.fn(() => Promise.resolve<{ latitude: number; longitude: number } | null>(null)),
)
vi.mock('../api/position', () => ({ positionSiAutorisee: position }))

const carte = (id: string, nom: string, auteur: string | null = null) => ({
  id,
  nom,
  imageUrl: null,
  latitude: 43.2965,
  longitude: 5.3698,
  categorie: { icone: 'https://x/ruines.svg', couleur: '#a9260f' },
  auteur: auteur ? { id: 'a' + id, nom: auteur, avatarUrl: null } : null,
})

const PROFIL: ExplorateurProfile = {
  id: 'u1',
  nom: 'Uriel',
  avatarUrl: null,
  niveau: 12,
  titres: [{ id: 1, nom: 'Chevalier errant', condition: { stat: 'places_visited', min: 50 } }],
  bio: 'Fondateur de @runesdechene',
  instagram: 'uriel.runesdechene',
  inscritLe: '2024-09-30T10:00:00+00:00',
  porteurVerifie: true,
  role: 'admin',
  attache: 'Noble représentant des Alpes-Maritimes',
  fragments: [{ id: 3, nom: 'Hoplite', imageUrl: null }],
  ajoutes: [carte('p1', 'Dolmen de la Pierre Levée')],
  visites: [carte('p2', 'Abbaye du Thoronet', 'Gautier de Bilskirnir')],
  envies: [carte('p3', 'Mont Bégo')],
  signe: null,
  fragmentsADecouvrir: 5,
  estMoi: true,
}

function afficher(profil: ExplorateurProfile | null) {
  fetchExplorateur.mockResolvedValue(profil)
  const router = createMemoryRouter(
    [
      { path: '/:tab/explorateur/:id', element: <ProfilExplorateur id="u1" /> },
      { path: '/codex', element: null },
    ],
    { initialEntries: ['/carte/explorateur/u1'] },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

test('mon profil : « Modifier mon profil », jamais de murmure', async () => {
  afficher(PROFIL)
  expect(await screen.findByRole('button', { name: 'Modifier mon profil' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /murmure/ })).toBeNull()
})

test('le profil d’un autre : « Envoyer un murmure », jamais « Modifier »', async () => {
  afficher({ ...PROFIL, estMoi: false })
  expect(await screen.findByRole('button', { name: /Envoyer un murmure/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Modifier mon profil' })).toBeNull()
})

test('l’en-tête dit qui il est', async () => {
  afficher(PROFIL)
  expect(await screen.findByText('Uriel')).toBeInTheDocument()
  expect(screen.getByText('Niveau 12')).toBeInTheDocument()
  expect(screen.getByText('Chevalier errant')).toBeInTheDocument()
  expect(screen.getByText('Noble représentant des Alpes-Maritimes')).toBeInTheDocument()
  expect(screen.getByText('Explorateur depuis le 30 septembre 2024')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '@runesdechene' })).toHaveAttribute(
    'href',
    'https://www.instagram.com/runesdechene/',
  )
})

test('Explorateur introuvable : un message, jamais un écran vide', async () => {
  afficher(null)
  expect(await screen.findByText('Cet Explorateur est introuvable')).toBeInTheDocument()
})

test('toucher un titre dit comment il a été gagné', async () => {
  afficher(PROFIL)
  await userEvent.click(await screen.findByRole('button', { name: /Chevalier errant/ }))
  expect(screen.getByRole('dialog', { name: 'Chevalier errant' })).toHaveTextContent(
    'Débloqué en visitant 50 lieux sur place.',
  )
})

test('sous le signe d’un Fragment : filigrane et ligne discrète', async () => {
  afficher({ ...PROFIL, signe: { id: 3, nom: 'Hoplite', imageUrl: 'https://x/h.webp' } })
  expect(await screen.findByText('sous le signe de l’Hoplite')).toBeInTheDocument()
  expect(document.querySelector('img[src="https://x/h.webp"]')).not.toBeNull()
})

test('sur mon profil, toucher un Fragment permet de me placer sous son signe', async () => {
  afficher(PROFIL)
  await userEvent.click(await screen.findByRole('button', { name: /Hoplite/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Me placer sous ce signe' }))
  expect(choisirSigne).toHaveBeenCalledWith(3)
})

test('sur le profil d’un autre, ses Fragments ne se choisissent pas', async () => {
  afficher({ ...PROFIL, estMoi: false })
  await screen.findByText('Hoplite')
  expect(screen.queryByRole('button', { name: /Hoplite/ })).toBeNull()
})

test('les découvertes en trois sections, chacune avec son nombre', async () => {
  afficher(PROFIL)
  expect(await screen.findByRole('region', { name: 'Lieux ajoutés' })).toHaveTextContent('1')
  expect(screen.getByRole('region', { name: 'Visités' })).toHaveTextContent('Abbaye du Thoronet')
  expect(screen.getByRole('region', { name: 'Envie d’y aller' })).toHaveTextContent('Mont Bégo')
})

test('envies masquées : pas de section « Envie d’y aller » du tout', async () => {
  afficher({ ...PROFIL, estMoi: false, envies: null })
  await screen.findByRole('region', { name: 'Visités' })
  expect(screen.queryByRole('region', { name: 'Envie d’y aller' })).toBeNull()
})

test('un lieu visité dit qui l’a ajouté', async () => {
  afficher(PROFIL)
  expect(await screen.findByText('par Gautier de Bilskirnir')).toBeInTheDocument()
})

test('sans position autorisée, aucune distance', async () => {
  position.mockResolvedValue(null)
  afficher(PROFIL)
  await screen.findByText('Abbaye du Thoronet')
  expect(screen.queryByText(/km/)).toBeNull()
})

test('avec la position de celui qui regarde, la distance de chaque lieu', async () => {
  position.mockResolvedValue({ latitude: 43.7102, longitude: 7.262 })
  afficher(PROFIL)
  expect(await screen.findAllByText('159 km')).toHaveLength(3)
})

test('le bandeau de chiffres : lieux ajoutés, visités, fragments', async () => {
  afficher(PROFIL)
  const chiffres = await screen.findByRole('list', { name: 'En chiffres' })
  expect(chiffres).toHaveTextContent('1Lieu ajouté')
  expect(chiffres).toHaveTextContent('1Lieu visité')
  expect(chiffres).toHaveTextContent('1Fragment')
})

test('sur mon profil, une tuile invite à découvrir les autres Fragments, vers le Codex', async () => {
  const router = afficher(PROFIL)
  await userEvent.click(await screen.findByRole('button', { name: /5 à découvrir/ }))
  expect(router.state.location.pathname).toBe('/codex')
})

test('chez un autre, jamais de Fragments manquants', async () => {
  afficher({ ...PROFIL, estMoi: false, fragmentsADecouvrir: null })
  await screen.findByText('Hoplite')
  expect(screen.queryByText(/à découvrir/)).toBeNull()
})
