/**
 * QUOI     — la coquille navigue par URL et garde les quatre écrans montés.
 * POURQUOI — c'est la promesse centrale de la navigation (spec socle §4bis).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, vi } from 'vitest'
import { routes } from '../router'

vi.mock('../access/useV2Access', () => ({
  useV2Access: () => ({
    state: { status: 'ready', hasSession: true, hasAccess: true },
    retry: () => undefined,
  }),
}))

// L'Accueil lit la base : un lieu ajouté, « La loutre », suffit à le reconnaître.
vi.mock('@/features/accueil/api/accueil', () => ({
  fetchBanniere: () => Promise.resolve(null),
  fetchPresDeMoi: () => Promise.resolve([]),
  fetchGrandsExplorateurs: () => Promise.resolve({ tete: [], moi: null, dixieme: null }),
  fetchAjoutes: () =>
    Promise.resolve([
      {
        id: 'l1',
        nom: 'La loutre',
        imageUrl: null,
        latitude: null,
        longitude: null,
        categorie: null,
        auteur: { nom: 'Luna', avatarUrl: null },
      },
    ]),
  fetchChemins: () => Promise.resolve([]),
  saluer: () => Promise.resolve({ saluts: 0, salue: false }),
}))

// Les Murmures : personne n'attend de réponse, sauf là où un test le dit.
const murmures = vi.hoisted(() => ({
  fetchFils: vi.fn<() => Promise<{ nonLus: number }[]>>(),
  ecouterMurmures: () => () => undefined,
}))
vi.mock('@/features/messages/api/murmures', () => murmures)
// La communauté : rien de raté, sauf là où un test le dit.
const registre = vi.hoisted(() => ({
  fetchRegistreNonLus: vi.fn<() => Promise<{ messages: number; mentions: number }>>(),
  ecouterRegistre: () => () => undefined,
  fetchRegistre: () => Promise.resolve([]),
  marquerRegistreLu: () => Promise.resolve(),
  fetchPassages: () => Promise.resolve([]),
  ecrire: () => Promise.resolve(),
  chercherExplorateurs: () => Promise.resolve([]),
}))
vi.mock('@/features/messages/api/registre', () => registre)
vi.mock('@/features/enigmes/api/mesEnigmes', () => ({
  fetchMesEnigmes: () => Promise.resolve({ resolues: 137, total: 451, cultures: [] }),
  fetchMaCulture: () => Promise.reject(new Error('pas dans ce test')),
}))
vi.mock('@/features/titres/api/mesTitres', () => ({
  fetchMesTitres: () =>
    Promise.resolve({ obtenus: 0, total: 0, chemins: [], cultures: [], polymathe: null }),
}))
// Téléphone par défaut ; un test passe sur PC avec `ecran.pc = true`.
const ecran = vi.hoisted(() => ({ pc: false }))
vi.mock('@/shared/hooks/useSurOrdinateur', () => ({ useSurOrdinateur: () => ecran.pc }))

beforeEach(() => {
  ecran.pc = false
  murmures.fetchFils.mockResolvedValue([])
  registre.fetchRegistreNonLus.mockResolvedValue({ messages: 0, mentions: 0 })
})

function renderAt(path: string | string[]) {
  const entrees = typeof path === 'string' ? [path] : path
  const router = createMemoryRouter(routes, {
    initialEntries: entrees,
    initialIndex: entrees.length - 1,
  })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

test('sur téléphone, un onglet ne démarre qu’à sa première visite, puis reste monté', async () => {
  const router = renderAt('/accueil')
  await screen.findByText('La loutre')
  expect(screen.queryByTestId('carte')).toBeNull()
  await act(async () => {
    await router.navigate('/carte')
  })
  // Premier chargement de la carte (import paresseux) : sous la charge de toute la suite, il
  // dépasse parfois la seconde d'attente par défaut.
  expect(await screen.findByTestId('carte', {}, { timeout: 5000 })).toBeInTheDocument()
  await act(async () => {
    await router.navigate('/accueil')
  })
  expect(screen.getByTestId('carte')).toBeInTheDocument()
})

test('/ redirige vers l’Accueil', async () => {
  const router = renderAt('/')
  expect(await screen.findByText('La loutre')).toBeVisible()
  expect(router.state.location.pathname).toBe('/accueil')
})

test('un onglet inconnu redirige vers l’Accueil', async () => {
  const router = renderAt('/nimporte')
  await screen.findByText('La loutre')
  expect(router.state.location.pathname).toBe('/accueil')
})

test('changer d’onglet affiche le nouvel écran et garde l’ancien monté', async () => {
  const router = renderAt('/accueil')
  await userEvent.click(await screen.findByRole('button', { name: 'Carte' }))
  expect(router.state.location.pathname).toBe('/carte')
  expect(screen.getByTestId('carte')).toBeVisible()
  expect(screen.getByText('La loutre')).not.toBeVisible()
  expect(screen.getByText('La loutre')).toBeInTheDocument()
})

test('changer d’onglet ajoute une entrée : le retour ramène à l’onglet précédent', async () => {
  const router = renderAt('/accueil')
  await userEvent.click(await screen.findByRole('button', { name: 'Messages' }))
  await router.navigate(-1)
  expect(router.state.location.pathname).toBe('/accueil')
})

test('l’onglet actif est annoncé', async () => {
  renderAt('/messages')
  expect(await screen.findByRole('button', { name: 'Messages' })).toHaveAttribute(
    'aria-current',
    'page',
  )
})

test('l’onglet Messages porte le nombre de murmures non lus', async () => {
  murmures.fetchFils.mockResolvedValue([{ nonLus: 2 }, { nonLus: 0 }, { nonLus: 1 }])
  renderAt('/accueil')
  // jsdom ne connaît pas le CSS : il colle « Messages » et « 3 non lus » (pas le navigateur).
  expect(await screen.findByRole('button', { name: /^Messages ?3 non lus$/ })).toBeInTheDocument()
})

test('sans murmure, des messages ratés de la communauté : un point discret, sans nombre', async () => {
  registre.fetchRegistreNonLus.mockResolvedValue({ messages: 4, mentions: 0 })
  renderAt('/accueil')
  expect(
    await screen.findByRole('button', { name: /^Messages ?Nouveaux messages$/ }),
  ).toBeInTheDocument()
})

test('des murmures et des messages ratés : le rouge des murmures l’emporte', async () => {
  murmures.fetchFils.mockResolvedValue([{ nonLus: 1 }])
  registre.fetchRegistreNonLus.mockResolvedValue({ messages: 4, mentions: 0 })
  renderAt('/accueil')
  expect(await screen.findByRole('button', { name: /^Messages ?1 non lus$/ })).toBeInTheDocument()
})

test('mentionné dans la communauté : du rouge, comme un murmure, et les deux s’additionnent', async () => {
  murmures.fetchFils.mockResolvedValue([{ nonLus: 1 }])
  registre.fetchRegistreNonLus.mockResolvedValue({ messages: 4, mentions: 2 })
  renderAt('/accueil')
  expect(await screen.findByRole('button', { name: /^Messages ?3 non lus$/ })).toBeInTheDocument()
})

test('un détail rouvert par son onglet se ferme sur l’onglet, pas sur l’onglet d’avant', async () => {
  const router = renderAt('/messages/preferences')
  await userEvent.click(await screen.findByRole('button', { name: 'Accueil' }))
  await userEvent.click(screen.getByRole('button', { name: 'Messages' }))
  expect(router.state.location.pathname).toBe('/messages/preferences')
  await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
  await vi.waitFor(() => {
    expect(router.state.location.pathname).toBe('/messages')
  })
})

test('Notifications ouvert par-dessus un détail se ferme sur l’onglet, sans rouvrir le détail', async () => {
  // Uriel, 30/09 : la flèche de retour rouvrait le dernier lieu ouvert.
  const router = renderAt(['/accueil', '/accueil/chemins'])
  await userEvent.click(await screen.findByRole('button', { name: 'Notifications' }))
  expect(router.state.location.pathname).toBe('/accueil/notifications')
  await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
  await vi.waitFor(() => {
    expect(router.state.location.pathname).toBe('/accueil')
  })
})

test('un lien « Revenir V1 » est toujours visible, et retient le choix de la V1', async () => {
  document.cookie = 'explore_version=v2; path=/'
  renderAt('/messages')
  const lien = await screen.findByRole('link', { name: 'Revenir V1' })
  expect(lien).toHaveAttribute('href', '/')
  // Sans ce choix, la V1 renverrait aussitôt vers la V2 (son pop-up l'a retenue).
  lien.addEventListener('click', (e) => {
    e.preventDefault()
  })
  await userEvent.click(lien)
  expect(document.cookie).toContain('explore_version=v1')
})

test('une barre oblique finale n’ouvre pas de détail', async () => {
  renderAt('/carte/')
  await screen.findByTestId('carte')
  expect(document.querySelector('[data-detail]')).toBeNull()
})

test('l’en-tête porte « Notifications », la barre porte le Compte ; un seul « + », sur la carte', async () => {
  renderAt('/carte')
  expect(await screen.findByRole('button', { name: 'Ajouter un lieu' })).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: /Ajouter/ })).toHaveLength(1)
  expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Compte/ })).toBeInTheDocument()
})

test('le « + » de la carte ouvre la feuille « Ajouter »', async () => {
  const router = renderAt('/carte')
  await userEvent.click(await screen.findByRole('button', { name: 'Ajouter un lieu' }))
  expect(router.state.location.pathname).toBe('/carte/ajouter')
  expect(await screen.findByRole('dialog', { name: 'Ajouter sur la carte' })).toBeInTheDocument()
})

test('sur l’Accueil, la carte reste montée derrière le tiroir (desktop)', async () => {
  renderAt('/accueil')
  await screen.findByText('La loutre')
  const carte = screen.getByRole('region', { name: 'Carte' })
  expect(carte).not.toHaveAttribute('hidden')
  expect(carte).toHaveAttribute('data-derriere')
  expect(document.querySelector('[data-ecran="messages"]')).toHaveAttribute('hidden')
})

function coquille() {
  const element = document.querySelector('main')?.parentElement
  if (!element) throw new Error('pas de coquille')
  return element
}

test('replier le panneau le masque sans changer d’adresse, et on peut le déplier', async () => {
  const router = renderAt('/compte')
  await userEvent.click(await screen.findByRole('button', { name: 'Replier le panneau' }))
  expect(router.state.location.pathname).toBe('/compte')
  expect(coquille()).not.toHaveAttribute('data-tiroir')
  await userEvent.click(screen.getByRole('button', { name: 'Déplier le panneau' }))
  expect(coquille()).toHaveAttribute('data-tiroir', 'open')
})

test('toucher un onglet déplie le panneau, même l’onglet déjà ouvert', async () => {
  renderAt('/compte')
  await userEvent.click(await screen.findByRole('button', { name: 'Replier le panneau' }))
  await userEvent.click(screen.getByRole('button', { name: 'Compte' }))
  expect(coquille()).toHaveAttribute('data-tiroir', 'open')
})

test('sur la Carte, déplier rouvre le dernier onglet du tiroir', async () => {
  const router = renderAt('/messages')
  await userEvent.click(await screen.findByRole('button', { name: 'Carte' }))
  expect(coquille()).not.toHaveAttribute('data-tiroir')
  await userEvent.click(screen.getByRole('button', { name: 'Déplier le panneau' }))
  expect(router.state.location.pathname).toBe('/messages')
})

function curseur() {
  return screen
    .getByRole('navigation', { name: 'Navigation principale' })
    .querySelector('[style*="--rang"]')
}

test('sur PC, le fond de l’onglet actif glisse d’un onglet à l’autre (Carte exclue)', async () => {
  renderAt('/messages')
  await screen.findByRole('button', { name: 'Messages' })
  expect(curseur()?.getAttribute('style')).toContain('--rang: 1')
  await userEvent.click(screen.getByRole('button', { name: 'Compagnies' }))
  expect(curseur()?.getAttribute('style')).toContain('--rang: 2')
  await userEvent.click(screen.getByRole('button', { name: 'Carte' }))
  expect(curseur()).toBeNull()
})

// Le menu du profil (maquette 476:434, Uriel 07/10), sur téléphone : le portrait l'ouvre ; la coupe,
// l'engrenage et la sortie y sont entrés ; la cloche reste dans la barre. Sur PC, rien ne change :
// les icônes restent en bas à gauche et le portrait mène au profil (Uriel, 07/10).
async function ouvrirLeMenu() {
  await userEvent.click(await screen.findByRole('button', { name: 'Compte' }))
  return screen.findByRole('dialog', { name: 'Mon menu' })
}

test('toucher le portrait ouvre le menu du profil, même depuis Compte', async () => {
  renderAt('/compte')
  const menu = await ouvrirLeMenu()
  for (const nom of [
    'Mon profil',
    'Les énigmes',
    'Tous les titres',
    'Préférences',
    'Se déconnecter',
  ]) {
    expect(within(menu).getByRole('button', { name: new RegExp(nom) })).toBeInTheDocument()
  }
})

test('« Mon profil » ferme le menu et ouvre l’onglet Compte', async () => {
  const router = renderAt('/accueil')
  const menu = await ouvrirLeMenu()
  await userEvent.click(within(menu).getByRole('button', { name: /Mon profil/ }))
  expect(router.state.location.pathname).toBe('/compte')
  expect(screen.queryByRole('dialog', { name: 'Mon menu' })).toBeNull()
})

test('« Les énigmes » et « Tous les titres » s’ouvrent en panneau sur l’onglet courant', async () => {
  const router = renderAt('/accueil')
  await userEvent.click(within(await ouvrirLeMenu()).getByRole('button', { name: /Les énigmes/ }))
  expect(router.state.location.pathname).toBe('/accueil/enigmes')
  await userEvent.click(
    within(await ouvrirLeMenu()).getByRole('button', { name: /Tous les titres/ }),
  )
  expect(router.state.location.pathname).toBe('/accueil/titres')
})

test('« Préférences » s’ouvre depuis le menu', async () => {
  const router = renderAt('/carte')
  await userEvent.click(within(await ouvrirLeMenu()).getByRole('button', { name: /Préférences/ }))
  expect(router.state.location.pathname).toBe('/carte/preferences')
})

test('sur téléphone, la cloche reste dans la barre ; la coupe, l’engrenage et la sortie n’y sont plus', async () => {
  renderAt('/carte')
  expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Tous les titres' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Préférences' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Se déconnecter' })).toBeNull()
})

test('sur PC, toucher le portrait ouvre le profil, sans menu', async () => {
  ecran.pc = true
  const router = renderAt('/accueil')
  await userEvent.click(await screen.findByRole('button', { name: 'Compte' }))
  expect(router.state.location.pathname).toBe('/compte')
  expect(screen.queryByRole('dialog', { name: 'Mon menu' })).toBeNull()
})

test('sur PC, les énigmes, les titres, les préférences et la sortie sont dans la barre, autour de la cloche', async () => {
  ecran.pc = true
  const router = renderAt('/accueil')
  await userEvent.click(await screen.findByRole('button', { name: 'Les énigmes' }))
  expect(router.state.location.pathname).toBe('/accueil/enigmes')
  await userEvent.click(screen.getByRole('button', { name: 'Tous les titres' }))
  expect(router.state.location.pathname).toBe('/accueil/titres')
  await userEvent.click(screen.getByRole('button', { name: 'Préférences' }))
  expect(router.state.location.pathname).toBe('/accueil/preferences')
  expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument()
})
