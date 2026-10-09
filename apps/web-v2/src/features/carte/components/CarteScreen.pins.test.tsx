/**
 * QUOI     — mes pins sur la carte : la couche se pose une fois et reçoit les pins que l'app passe,
 *            un toucher rend l'id du pin, le visiteur n'en voit aucun, et « Voir sur la carte » fait
 *            voler la carte jusqu'au pin (une fois le tiroir mesuré) puis le dit à l'app.
 * POURQUOI — MapLibre ne tourne pas dans jsdom : la fausse carte vient de `src/test/`.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FausseCarte } from '@/test/fausseCarte'
import { CarteScreen, CarteVisiteur } from './CarteScreen'

vi.mock('../api/carte', () => ({
  fetchCarteLieux: vi.fn(() => Promise.resolve([])),
  fetchCartePublique: vi.fn(() => Promise.resolve([])),
  fetchLieuxEnCouleur: vi.fn(() => Promise.resolve(false)),
  fetchTerritoire: vi.fn(() => Promise.resolve({ territoire: null, pays: null })),
  fetchFiltres: vi.fn(() => Promise.resolve({ natures: [], epoques: [] })),
}))
const navigations = vi.hoisted(() => vi.fn())
vi.mock('react-router', async (original) => ({
  ...(await original<typeof import('react-router')>()),
  useNavigate: () => navigations,
}))
vi.mock('../api/actifs', () => ({ fetchActifs: vi.fn(() => Promise.resolve([])) }))
vi.mock('../lib/sceaux', async (original) => ({
  ...(await original<typeof import('../lib/sceaux')>()),
  ajouterMarques: vi.fn(() => Promise.resolve()),
  prechargerIcones: vi.fn(),
}))

const MES_PINS = [{ id: 'p1', point: { latitude: 43.7, longitude: 7.2 }, jours: 12 }]

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private rappel: (e: { contentRect: { width: number } }[]) => void) {}
      observe() {
        this.rappel([{ contentRect: { width: 420 } }])
      }
      disconnect() {}
    },
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function carte(): FausseCarte {
  if (!FausseCarte.derniere) throw new Error('pas de carte')
  return FausseCarte.derniere
}

function charger() {
  act(() => {
    carte().emettre('style.load')
  })
}

function monter(ecran: React.ReactElement) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>{ecran}</MemoryRouter>
    </QueryClientProvider>,
  )
}

function afficher(props: ComponentProps<typeof CarteScreen>) {
  monter(<CarteScreen {...props} />)
}

test('mes pins : la couche se pose une fois et reçoit les pins passés', () => {
  afficher({ mesPins: MES_PINS })
  charger()
  charger()
  expect(carte().addLayer.mock.calls.filter(([c]) => c.id === 'mes-pins')).toHaveLength(1)
  expect(carte().getSource('mes-pins').setData).toHaveBeenLastCalledWith(
    expect.objectContaining({
      features: [expect.objectContaining({ properties: { id: 'p1', jours: '12 j' } })],
    }),
  )
})

test('mes pins : toucher un pin rend son id', () => {
  const onToucherPin = vi.fn()
  afficher({ mesPins: MES_PINS, onToucherPin })
  charger()
  carte().emettre('click', { features: [{ properties: { id: 'p1' } }] })
  expect(onToucherPin).toHaveBeenCalledWith('p1')
})

test('le visiteur ne voit aucun pin', () => {
  monter(<CarteVisiteur />)
  charger()
  expect(carte().addLayer.mock.calls.some(([c]) => c.id === 'mes-pins')).toBe(false)
})

test('« Voir sur la carte » : la carte vole jusqu’au pin, une fois le tiroir mesuré, puis le dit', () => {
  const onCentre = vi.fn()
  afficher({ centrerSur: { latitude: 43.7, longitude: 7.2 }, onCentre })
  expect(onCentre).not.toHaveBeenCalled()
  charger()
  expect(carte().flyTo).toHaveBeenCalledWith(
    expect.objectContaining({ center: [7.2, 43.7], zoom: 16 }),
  )
  expect(carte().jumpTo.mock.invocationCallOrder[0]).toBeLessThan(
    carte().flyTo.mock.invocationCallOrder[0] ?? 0,
  )
  expect(onCentre).toHaveBeenCalledTimes(1)
})

test('mes pins : après un second style.load, la source reçoit de nouveau les pins', () => {
  afficher({ mesPins: MES_PINS })
  charger()
  const { setData } = carte().getSource('mes-pins')
  setData.mockClear()
  charger()
  expect(setData).toHaveBeenCalledWith(
    expect.objectContaining({
      features: [expect.objectContaining({ properties: { id: 'p1', jours: '12 j' } })],
    }),
  )
})

test('un pin posé sur un lieu : son toucher n’ouvre que le pin', () => {
  const onToucherPin = vi.fn()
  afficher({ mesPins: MES_PINS, onToucherPin })
  charger()
  carte().queryRenderedFeatures.mockReturnValue([{}])
  carte().emettre('click', { point: { x: 1, y: 2 }, features: [{ properties: { id: 'p1' } }] })
  expect(onToucherPin).toHaveBeenCalledTimes(1)
  expect(navigations).not.toHaveBeenCalled()
})
