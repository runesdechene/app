/**
 * QUOI     — le geste « Découvrir » : le voile, la récompense, puis la fiche ou la carte.
 * ATTENTION — jsdom ne dessine ni n'anime : la fin de l'arrachage du voile est simulée
 *            (`animationEnd`), le grattage au doigt n'est pas rejoué ici (le bouton suffit).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import type { FicheLieu } from '../api/lireLieu'
import { DecouverteLieu } from './DecouverteLieu'

const api = vi.hoisted(() => ({ decouvrirLieu: vi.fn() }))
vi.mock('../api/lieu', () => api)

const FICHE: Pick<FicheLieu, 'id' | 'nom' | 'photos' | 'type' | 'moi'> = {
  id: 'a',
  nom: 'Château de Jonjeac',
  photos: [{ url: 'photo.jpg', vignette: 'v.jpg' }],
  type: { nom: 'Château et fortins', icone: null, couleur: null },
  moi: { visiteLe: null, envie: false, decouvert: false },
}

beforeEach(() => {
  api.decouvrirLieu.mockResolvedValue({ rang: 38, gain: 1, niveau: 12, avant: 0.62, apres: 0.64 })
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
  await userEvent.click(screen.getByRole('button', { name: 'Découvrir' }))
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

test('« Découvrir » arrache le voile : la récompense dit le rang, l’expérience et le niveau', async () => {
  const { container } = monter()
  await decouvrir(container)
  expect(api.decouvrirLieu).toHaveBeenCalledWith('a')
  expect(screen.getByRole('heading', { name: 'Château de Jonjeac' })).toBeInTheDocument()
  expect(screen.getByText('+1 d’expérience')).toBeInTheDocument()
  expect(screen.getByText('Niveau 12')).toBeInTheDocument()
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

test('une découverte refusée le dit, et se retente', async () => {
  api.decouvrirLieu.mockRejectedValueOnce(new Error('réseau'))
  monter()
  await userEvent.click(screen.getByRole('button', { name: 'Découvrir' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'La découverte n’a pas pu être enregistrée.',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
  expect(api.decouvrirLieu).toHaveBeenCalledTimes(2)
})
