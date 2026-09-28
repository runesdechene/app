/**
 * QUOI     — l'écran Carte : si les lieux ne se chargent ou ne se dessinent pas, la carte reste et
 *            le dit ; un dessin ancien n'écrase jamais le récent ; la 3D ne se reconstruit pas à
 *            chaque zoom ; sans position, « Ma position » le dit.
 * POURQUOI — MapLibre ne tourne pas dans jsdom : la fausse carte vient de `src/test/`.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import { FausseCarte } from '@/test/fausseCarte'
import type { LieuCarte } from '../api/lireCarte'
import { CarteScreen } from './CarteScreen'

const api = vi.hoisted(() => ({
  fetchCarteLieux: vi.fn<() => Promise<LieuCarte[]>>(),
  fetchLieuxEnCouleur: vi.fn(() => Promise.resolve(false)),
  fetchTerritoire: vi.fn(() => Promise.resolve({ territoire: null, pays: null })),
}))
vi.mock('../api/carte', () => api)

const marques = vi.hoisted(() => ({ ajouterMarques: vi.fn<() => Promise<void>>() }))
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
  },
]

beforeEach(() => {
  api.fetchCarteLieux.mockResolvedValue(LIEUX)
  marques.ajouterMarques.mockResolvedValue(undefined)
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

function charger() {
  act(() => {
    carte().emettre('load')
  })
}

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
  await userEvent.click(screen.getByRole('switch', { name: 'Seulement mes lieux' }))
  await waitFor(() => {
    expect(carte().source.setData).toHaveBeenCalledTimes(1)
  })

  await act(async () => {
    finirPremier()
    await Promise.resolve()
  })
  expect(carte().source.setData).toHaveBeenCalledTimes(1)
  expect(carte().source.setData.mock.lastCall?.[0]).toMatchObject({
    features: [{ properties: { id: 'connu' } }],
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

test('le bouton Filtre ouvre la feuille « Seulement mes lieux »', async () => {
  afficher()
  await userEvent.click(screen.getByRole('button', { name: 'Filtre' }))
  expect(screen.getByRole('dialog', { name: 'Filtrer la carte' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('switch', { name: 'Seulement mes lieux' }))
  expect(screen.getByRole('switch', { name: 'Seulement mes lieux' })).toBeChecked()
})

test('quand le tiroir s’ouvre, la carte vise le centre de sa partie visible', () => {
  let signaler: (largeur: number) => void = () => {}
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(rappel: (entrees: { contentRect: { width: number } }[]) => void) {
        signaler = (largeur) => {
          rappel([{ contentRect: { width: largeur } }])
        }
      }
      observe() {}
      disconnect() {}
    },
  )
  afficher()
  charger()
  act(() => {
    signaler(420)
  })
  expect(carte().easeTo).toHaveBeenLastCalledWith(
    expect.objectContaining({ padding: { left: 420, top: 0, right: 0, bottom: 0 } }),
  )
})
test('?centre=lat,lng : la carte vole jusqu’au lieu une fois chargée', () => {
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
})
