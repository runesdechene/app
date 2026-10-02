/**
 * QUOI     — l'écran Carte : si les lieux ne se chargent ou ne se dessinent pas, la carte reste et
 *            le dit ; un dessin ancien n'écrase jamais le récent ; la 3D ne se reconstruit pas à
 *            chaque zoom ; sans position, « Ma position » le dit. Le visiteur sans compte a la
 *            carte publique, sans filtre ni préférences, et elle glisse jusqu'au lieu ouvert.
 * POURQUOI — MapLibre ne tourne pas dans jsdom : la fausse carte vient de `src/test/`.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { vi } from 'vitest'
import { FausseCarte } from '@/test/fausseCarte'
import type { LieuCarte } from '../api/lireCarte'
import { CarteScreen, CarteVisiteur } from './CarteScreen'

const api = vi.hoisted(() => ({
  fetchCarteLieux: vi.fn<() => Promise<LieuCarte[]>>(),
  fetchCartePublique: vi.fn<() => Promise<LieuCarte[]>>(),
  fetchLieuxEnCouleur: vi.fn(() => Promise.resolve(false)),
  fetchTerritoire: vi.fn(() => Promise.resolve({ territoire: null, pays: null })),
  fetchFiltres: vi.fn(() => Promise.resolve({ natures: [], epoques: [] })),
}))
vi.mock('../api/carte', () => api)

const actifs = vi.hoisted(() => ({ fetchActifs: vi.fn<() => Promise<unknown[]>>() }))
vi.mock('../api/actifs', () => actifs)

const marques = vi.hoisted(() => ({
  ajouterMarques: vi.fn<() => Promise<void>>(),
  prechargerIcones: vi.fn(),
}))
vi.mock('../lib/sceaux', async (original) => ({
  ...(await original<typeof import('../lib/sceaux')>()),
  ...marques,
}))

const LIEUX: LieuCarte[] = [
  {
    id: 'connu',
    nom: 'Trophée',
    lat: 43.7,
    lng: 7.4,
    nature: 'lieu',
    icone: null,
    couleur: null,
    etat: 'connu',
    revendication: null,
    natures: [],
    epoque: null,
    ajoute: false,
  },
  {
    id: 'inconnu',
    nom: 'Borne',
    lat: 44,
    lng: 7,
    nature: 'lieu',
    icone: null,
    couleur: null,
    etat: 'inconnu',
    revendication: null,
    natures: [],
    epoque: null,
    ajoute: false,
  },
]

beforeEach(() => {
  api.fetchCarteLieux.mockResolvedValue(LIEUX)
  marques.ajouterMarques.mockResolvedValue(undefined)
  actifs.fetchActifs.mockResolvedValue([])
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CarteScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function carte(): FausseCarte {
  if (!FausseCarte.derniere) throw new Error('pas de carte')
  return FausseCarte.derniere
}

test('à la première ouverture, la carte dit que les lieux arrivent, puis se tait', async () => {
  afficher()
  const attente = screen.getByRole('status', { name: 'Les lieux arrivent…' })
  expect(attente).not.toHaveAttribute('data-fini')
  charger()
  await waitFor(() => {
    expect(attente).toHaveAttribute('data-fini')
  })
})

test('les lieux déjà gardés sur l’appareil : rien à attendre, rien n’est dit', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['carte', 'lieux'], LIEUX)
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CarteScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  expect(screen.queryByRole('status', { name: 'Les lieux arrivent…' })).toBeNull()
})

// Le style est prêt : les lieux n'attendent pas les tuiles du fond (02/10).
function charger() {
  act(() => {
    carte().emettre('style.load')
  })
}

test('les icônes des lieux partent dès que les lieux arrivent, avant que la carte soit prête', async () => {
  afficher()
  await waitFor(() => {
    expect(marques.prechargerIcones).toHaveBeenCalledWith(LIEUX)
  })
  expect(carte().source.setData).not.toHaveBeenCalled()
})

test('le relief ne se pose qu’une fois les lieux posés', async () => {
  afficher()
  charger()
  await waitFor(() => {
    expect(carte().addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ombrage' }),
      undefined,
    )
  })
  const ombrage = carte().addLayer.mock.calls.findIndex(
    ([c]) => (c as { id: string }).id === 'ombrage',
  )
  expect(carte().addLayer.mock.invocationCallOrder[ombrage]).toBeGreaterThan(
    carte().source.setData.mock.invocationCallOrder[0] ?? Infinity,
  )
})

test('un Actif devient un portrait sur la carte ; le toucher ouvre sa carte', async () => {
  actifs.fetchActifs.mockResolvedValue([
    {
      id: 'k1',
      nom: 'Kelpie',
      avatar: null,
      niveau: 17,
      titre: 'Arpenteur',
      signe: null,
      lat: 43.7,
      lng: 7.4,
      brouille: false,
      vuA: new Date().toISOString(),
      enLigne: true,
    },
  ])
  afficher()
  charger()
  expect(await screen.findByRole('button', { name: '1 actif' })).toBeInTheDocument()
  await userEvent.click(await screen.findByRole('button', { name: 'Kelpie' }))
  expect(await screen.findByRole('dialog', { name: 'Kelpie' })).toHaveTextContent(
    'Arpenteur · niveau 17',
  )
})

test('de très loin, les portraits restent, les noms se taisent', () => {
  afficher()
  charger()
  carte().zoom = 4
  act(() => {
    carte().emettre('zoom')
  })
  expect(carte().getContainer()).toHaveAttribute('data-loin')
  carte().zoom = 8
  act(() => {
    carte().emettre('zoom')
  })
  expect(carte().getContainer()).not.toHaveAttribute('data-loin')
})

test('si les lieux ne se chargent pas, la carte reste là et propose de réessayer', async () => {
  api.fetchCarteLieux.mockRejectedValue(new Error('réseau'))
  afficher()
  expect(await screen.findByText('Les lieux n’ont pas pu être chargés')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  expect(screen.getByTestId('carte')).toBeInTheDocument()
})

test('si les marques ne peuvent pas se dessiner, le bandeau le dit aussi', async () => {
  marques.ajouterMarques.mockRejectedValue(new Error('canevas indisponible'))
  afficher()
  charger()
  expect(await screen.findByText('Les lieux n’ont pas pu être chargés')).toBeInTheDocument()
})

test('un dessin plus ancien n’écrase jamais le plus récent', async () => {
  let finirPremier = () => {}
  marques.ajouterMarques.mockImplementationOnce(
    () =>
      new Promise(
        (resolve) =>
          (finirPremier = () => {
            resolve()
          }),
      ),
  )
  afficher()
  charger()
  await waitFor(() => {
    expect(marques.ajouterMarques).toHaveBeenCalledTimes(1)
  })

  await userEvent.click(screen.getByRole('button', { name: 'Filtre' }))
  await userEvent.click(screen.getByRole('radio', { name: 'À découvrir' }))
  await waitFor(() => {
    expect(carte().source.setData).toHaveBeenCalledTimes(1)
  })

  await act(async () => {
    finirPremier()
    await Promise.resolve()
  })
  expect(carte().source.setData).toHaveBeenCalledTimes(1)
  expect(carte().source.setData.mock.lastCall?.[0]).toMatchObject({
    features: [{ properties: { id: 'inconnu' } }],
  })
})

test('la 3D ne se reconstruit pas à chaque zoom', () => {
  afficher()
  const map = carte()
  map.inclinaison = 40
  map.zoom = 10
  map.emettre('zoomend')
  map.emettre('zoomend')
  map.emettre('pitchend')
  expect(map.setTerrain).toHaveBeenCalledTimes(1)
})

test('sans position, « Ma position » le dit sans planter', async () => {
  vi.stubGlobal('navigator', {
    geolocation: {
      getCurrentPosition: (_ok: unknown, ko: (e: unknown) => void) => {
        ko({ code: 1 })
      },
    },
  })
  afficher()
  await userEvent.click(screen.getByRole('button', { name: 'Ma position' }))
  expect(await screen.findByText('Position indisponible')).toBeInTheDocument()
})

test('sans géolocalisation du tout, « Ma position » le dit aussi', async () => {
  vi.stubGlobal('navigator', {})
  afficher()
  await userEvent.click(screen.getByRole('button', { name: 'Ma position' }))
  expect(await screen.findByText('Position indisponible')).toBeInTheDocument()
})

test('le bouton Filtre ouvre la feuille ; un filtre choisi se voit, et le bouton dit ce qui reste', async () => {
  afficher()
  await userEvent.click(screen.getByRole('button', { name: 'Filtre' }))
  expect(screen.getByRole('dialog', { name: 'Filtrer la carte' })).toBeInTheDocument()
  expect(await screen.findByRole('button', { name: 'Voir les 2 lieux' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('radio', { name: 'À découvrir' }))
  await userEvent.click(screen.getByRole('button', { name: 'Voir le lieu' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Filtre (actif)' })).toBeInTheDocument()
})

// Un ResizeObserver qui, comme celui du navigateur, mesure dès qu'il observe ; `signaler` en
// envoie d'autres (le tiroir qui s'ouvre ou se replie).
function tiroirDe(largeur: number) {
  let rappel: (entrees: { contentRect: { width: number } }[]) => void = () => {}
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(r: typeof rappel) {
        rappel = r
      }
      observe() {
        rappel([{ contentRect: { width: largeur } }])
      }
      disconnect() {}
    },
  )
  return (l: number) => {
    rappel([{ contentRect: { width: l } }])
  }
}

test('la carte se pose d’emblée à côté du tiroir, puis glisse quand il s’ouvre ou se replie', () => {
  const signaler = tiroirDe(0)
  afficher()
  charger()
  expect(carte().jumpTo).toHaveBeenCalledWith({
    padding: { left: 0, top: 0, right: 0, bottom: 0 },
  })
  expect(carte().easeTo).not.toHaveBeenCalled()
  act(() => {
    signaler(420)
  })
  expect(carte().easeTo).toHaveBeenLastCalledWith(
    expect.objectContaining({ padding: { left: 420, top: 0, right: 0, bottom: 0 } }),
  )
})

test('?centre=lat,lng : la carte vole jusqu’au lieu, et rien ne coupe son vol', () => {
  tiroirDe(420)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/carte?centre=45.9,6.1']}>
        <CarteScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  charger()
  expect(carte().flyTo).toHaveBeenCalledWith(
    expect.objectContaining({ center: [6.1, 45.9], zoom: 14 }),
  )
  // Le tiroir est mesuré avant le vol : aucune animation ne vient l'interrompre.
  expect(carte().jumpTo.mock.invocationCallOrder[0]).toBeLessThan(
    carte().flyTo.mock.invocationCallOrder[0] ?? 0,
  )
  expect(carte().easeTo).not.toHaveBeenCalled()
})

test('au survol d’un lieu, la main apparaît et le lieu se détache ; elle s’en va quand on le quitte', () => {
  afficher()
  charger()
  carte().emettre('mousemove', { features: [{ properties: { id: 'connu' } }] })
  expect(carte().canevas.style.cursor).toBe('pointer')
  expect(carte().setFilter).toHaveBeenLastCalledWith('survol', ['==', ['get', 'id'], 'connu'])
  carte().emettre('mouseleave')
  expect(carte().canevas.style.cursor).toBe('')
})

test('le visiteur voit la carte publique, sans filtre ni préférences, jusqu’au lieu ouvert', async () => {
  tiroirDe(0)
  api.fetchCartePublique.mockResolvedValue(LIEUX)
  api.fetchLieuxEnCouleur.mockClear()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/bienvenue/carte/lieu/inconnu']}>
        <Routes>
          <Route path="/bienvenue/carte/*" element={<CarteVisiteur />}>
            <Route path="lieu/:id" element={null} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  charger()
  await waitFor(() => {
    expect(carte().flyTo).toHaveBeenCalledWith({ center: [7, 44], zoom: 11 })
  })
  expect(api.fetchCarteLieux).not.toHaveBeenCalled()
  expect(api.fetchLieuxEnCouleur).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Filtre' })).not.toBeInTheDocument()
})
