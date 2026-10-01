/**
 * QUOI     — le geste « Découvrir » : le voile et son prix, la récompense, puis la fiche ou la carte.
 * ATTENTION — jsdom ne dessine ni n'anime : la fin de l'arrachage du voile est simulée
 *            (`animationEnd`), le grattage au doigt n'est pas rejoué ici (le bouton suffit).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import type { FicheLieu } from '../api/lireLieu'
import { DecouverteLieu } from './DecouverteLieu'

const api = vi.hoisted(() => ({ decouvrirLieu: vi.fn(), fetchCoutDecouverte: vi.fn() }))
vi.mock('../api/lieu', () => api)

const ici = vi.hoisted(() => ({
  position: null as { latitude: number; longitude: number } | null,
}))
// Comme le vrai crochet : la position vit dans le cache, sous ['ma-position'].
vi.mock('@/shared/hooks/useMaPosition', async () => {
  const { useQuery } = await import('@tanstack/react-query')
  return {
    useMaPosition: () =>
      useQuery({
        queryKey: ['ma-position'],
        queryFn: () => ici.position,
        initialData: ici.position,
        staleTime: Infinity,
      }).data ?? null,
  }
})

const demande = vi.hoisted(() => ({ demanderPosition: vi.fn() }))
vi.mock('@/shared/lib/position', () => demande)

const FICHE: Pick<FicheLieu, 'id' | 'nom' | 'photos' | 'type' | 'moi'> = {
  id: 'a',
  nom: 'Château de Jonjeac',
  photos: [{ url: 'photo.jpg', vignette: 'v.jpg' }],
  type: { nom: 'Château et fortins', icone: null, couleur: null },
  moi: { visiteLe: null, envie: false, decouvert: false },
}

const PRIX = { max: 10, prochainDans: null, parPoint: 3600, gratuitKm: 80 }

beforeEach(() => {
  ici.position = { latitude: 45, longitude: 1 }
  demande.demanderPosition.mockReset()
  demande.demanderPosition.mockResolvedValue(null)
  api.decouvrirLieu.mockReset()
  api.decouvrirLieu.mockResolvedValue({ rang: 38, gain: 1, niveau: 12, avant: 0.62, apres: 0.64 })
  api.fetchCoutDecouverte.mockReset()
  api.fetchCoutDecouverte.mockResolvedValue({ ...PRIX, cout: 0, distanceKm: 42, points: 10 })
})

function monter() {
  const client = new QueryClient()
  client.setQueryData(['lieu', 'a'], FICHE)
  const onFermer = vi.fn()
  const rendu = render(
    <QueryClientProvider client={client}>
      <DecouverteLieu fiche={FICHE} onFermer={onFermer} />
    </QueryClientProvider>,
  )
  return { client, onFermer, ...rendu }
}

async function decouvrir(container: HTMLElement) {
  await userEvent.click(await screen.findByRole('button', { name: 'Découvrir' }))
  const voile = container.querySelector('canvas')
  if (voile) fireEvent.animationEnd(voile)
  return screen.findByText('Ton 38ᵉ lieu découvert !')
}

test('le lieu reste voilé : ni son nom ni son type, seulement la consigne', () => {
  monter()
  expect(screen.getByRole('heading', { name: 'Un lieu inconnu' })).toBeInTheDocument()
  expect(screen.getByText('Passe ton doigt pour révéler le lieu')).toBeInTheDocument()
  expect(screen.queryByText('Château de Jonjeac')).toBeNull()
})

test('un lieu proche : gratuit, et la distance', async () => {
  monter()
  expect(await screen.findByText('Gratuit')).toBeInTheDocument()
  expect(screen.getByText('· à 42 km de toi')).toBeInTheDocument()
})

test('un lieu lointain : son prix, et ce qu’il restera', async () => {
  api.fetchCoutDecouverte.mockResolvedValue({ ...PRIX, cout: 2, distanceKm: 780, points: 7 })
  monter()
  expect(await screen.findByText('2 points d’énergie')).toBeInTheDocument()
  expect(screen.getByText('· à 780 km')).toBeInTheDocument()
  expect(screen.getByText('Il t’en restera 5 sur 10')).toBeInTheDocument()
})

test('pas assez d’énergie : le geste est fermé, on dit quand revenir', async () => {
  api.fetchCoutDecouverte.mockResolvedValue({
    ...PRIX,
    cout: 3,
    distanceKm: 2000,
    points: 1,
    prochainDans: 1380,
  })
  monter()
  expect(await screen.findByText('Il te faut 3 points')).toBeInTheDocument()
  expect(screen.getByText('· il t’en reste 1')).toBeInTheDocument()
  expect(screen.getByText('Reviens dans 1 h 23 pour le révéler')).toBeInTheDocument()
  expect(screen.getByText(/Le prochain point revient dans 23 min/)).toBeInTheDocument()
  expect(screen.getByText(/Les lieux à moins de 80 km restent gratuits/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Découvrir' })).toBeDisabled()
})

test('« Découvrir » arrache le voile : la récompense dit le rang, l’expérience et le niveau', async () => {
  const { container } = monter()
  await decouvrir(container)
  expect(api.decouvrirLieu).toHaveBeenCalledWith('a', { latitude: 45, longitude: 1 })
  expect(screen.getByRole('heading', { name: 'Château de Jonjeac' })).toBeInTheDocument()
  expect(screen.getByText('+1 d’expérience')).toBeInTheDocument()
  expect(screen.getByText('Niveau 12')).toBeInTheDocument()
})

test('le serveur refuse (la jauge a baissé ailleurs) : le voile revient, avec ses chiffres', async () => {
  api.fetchCoutDecouverte
    .mockResolvedValueOnce({ ...PRIX, cout: 1, distanceKm: 300, points: 5 })
    .mockResolvedValue({ ...PRIX, cout: 1, distanceKm: 300, points: 0, prochainDans: 600 })
  api.decouvrirLieu.mockRejectedValue(Object.assign(new Error('énergie'), { code: 'RDC01' }))
  monter()
  await userEvent.click(await screen.findByRole('button', { name: 'Découvrir' }))
  expect(await screen.findByText('Il te faut 1 point')).toBeInTheDocument()
  expect(screen.queryByText('Ton 38ᵉ lieu découvert !')).toBeNull()
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.getByRole('heading', { name: 'Un lieu inconnu' })).toBeInTheDocument()
})

test('après un refus, le voile est un voile neuf : repeint, prêt à être gratté', async () => {
  api.fetchCoutDecouverte.mockResolvedValue({ ...PRIX, cout: 1, distanceKm: 300, points: 5 })
  api.decouvrirLieu.mockRejectedValue(new Error('réseau'))
  const { container } = monter()
  await screen.findByText('1 point d’énergie')
  const avant = container.querySelector('canvas')
  await userEvent.click(screen.getByRole('button', { name: 'Découvrir' }))
  if (avant) fireEvent.animationEnd(avant)
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  const apres = container.querySelector('canvas')
  expect(apres).not.toBeNull()
  expect(apres).not.toBe(avant)
})

test('sans position : le prix sans position, et de quoi la donner', async () => {
  ici.position = null
  api.fetchCoutDecouverte.mockResolvedValue({ ...PRIX, cout: 3, distanceKm: null, points: 10 })
  monter()
  expect(await screen.findByText('3 points d’énergie')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Utiliser ma position' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Découvrir' })).toBeEnabled()
  expect(api.fetchCoutDecouverte).toHaveBeenCalledWith('a', null)
})

test('sans position, le voile la demande lui-même : un lieu proche redevient gratuit', async () => {
  ici.position = null
  demande.demanderPosition.mockResolvedValue({ latitude: 45, longitude: 1 })
  api.fetchCoutDecouverte.mockImplementation((_id: string, p: unknown) =>
    Promise.resolve(
      p
        ? { ...PRIX, cout: 0, distanceKm: 42, points: 10 }
        : { ...PRIX, cout: 3, distanceKm: null, points: 10 },
    ),
  )
  monter()
  expect(await screen.findByText('Gratuit')).toBeInTheDocument()
  expect(demande.demanderPosition).toHaveBeenCalledTimes(1)
})

test('la position arrive après : le prix se relit avec elle', async () => {
  ici.position = null
  api.fetchCoutDecouverte.mockImplementation((_id: string, p: unknown) =>
    Promise.resolve(
      p
        ? { ...PRIX, cout: 0, distanceKm: 42, points: 10 }
        : { ...PRIX, cout: 3, distanceKm: null, points: 10 },
    ),
  )
  const { client } = monter()
  expect(await screen.findByText('3 points d’énergie')).toBeInTheDocument()
  act(() => {
    client.setQueryData(['ma-position'], { latitude: 45, longitude: 1 })
  })
  expect(await screen.findByText('Gratuit')).toBeInTheDocument()
  expect(api.fetchCoutDecouverte).toHaveBeenLastCalledWith('a', { latitude: 45, longitude: 1 })
})

test('une découverte réussie relit la jauge', async () => {
  const { container, client } = monter()
  const relire = vi.spyOn(client, 'invalidateQueries')
  await decouvrir(container)
  await waitFor(() => {
    expect(relire).toHaveBeenCalledWith({ queryKey: ['energie'] })
  })
})

test('« Accéder au lieu » marque la fiche découverte : la route ouvre la fiche', async () => {
  const { container, client } = monter()
  await decouvrir(container)
  await userEvent.click(screen.getByRole('button', { name: 'Accéder au lieu' }))
  expect(client.getQueryData(['lieu', 'a'])).toMatchObject({ moi: { decouvert: true } })
})

test('la croix et « Revenir à la carte » ramènent à la carte', async () => {
  const { container, onFermer } = monter()
  await decouvrir(container)
  await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
  await userEvent.click(screen.getByRole('button', { name: 'Revenir à la carte' }))
  expect(onFermer).toHaveBeenCalledTimes(2)
})

test('une découverte qui échoue (réseau) le dit, et se retente', async () => {
  api.decouvrirLieu.mockRejectedValueOnce(new Error('réseau'))
  monter()
  await userEvent.click(await screen.findByRole('button', { name: 'Découvrir' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'La découverte n’a pas pu être enregistrée.',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
  expect(api.decouvrirLieu).toHaveBeenCalledTimes(2)
})
