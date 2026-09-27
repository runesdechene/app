/**
 * QUOI     — Modifier mon profil : champs pré-remplis, présentation tenue à 300 caractères,
 *            deux titres au plus, enregistrement, échec qui garde la saisie.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { ExplorateurProfile } from '../api/lireProfil'
import { ModifierProfil } from './ModifierProfil'

const api = vi.hoisted(() => ({
  enregistrerProfil: vi.fn(() => Promise.resolve()),
  choisirTitres: vi.fn(() => Promise.resolve()),
  choisirAccord: vi.fn(() => Promise.resolve()),
  titresDebloques: vi.fn(() =>
    Promise.resolve([
      { id: 1, nom: 'Chevalier errant' },
      { id: 2, nom: 'Hoplite' },
      { id: 3, nom: 'Arpenteur' },
    ]),
  ),
}))
vi.mock('../api/monProfil', () => api)
vi.mock('../api/avatar', () => ({ changerAvatar: vi.fn() }))
vi.mock('../api/session', () => ({ monIdentifiant: () => Promise.resolve('u1') }))
vi.mock('../api/preferences', () => ({
  mesPreferences: () =>
    Promise.resolve({
      email: 'u@x.fr',
      brouillerPistes: true,
      pushImportant: true,
      pushRecap: false,
      showDepartement: true,
      showEnvies: true,
      titleGender: 'm',
    }),
}))

const PROFIL: ExplorateurProfile = {
  id: 'u1',
  nom: 'Uriel',
  avatarUrl: null,
  niveau: 12,
  titres: [{ id: 1, nom: 'Chevalier errant' }],
  bio: 'Chevalier errant',
  instagram: 'uriel.runesdechene',
  inscritLe: '2024-09-30T10:00:00+00:00',
  porteurVerifie: true,
  role: null,
  attache: null,
  fragments: [],
  ajoutes: [],
  visites: [],
  envies: [],
  estMoi: true,
}
vi.mock('../api/explorateur', () => ({ fetchExplorateur: () => Promise.resolve(PROFIL) }))

function ouvrir() {
  const onTermine = vi.fn()
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ModifierProfil onTermine={onTermine} />
    </QueryClientProvider>,
  )
  return onTermine
}

test('les champs arrivent pré-remplis', async () => {
  ouvrir()
  expect(await screen.findByLabelText('Ton nom')).toHaveValue('Uriel')
  expect(screen.getByLabelText('Ta présentation')).toHaveValue('Chevalier errant')
  expect(screen.getByLabelText('Ton Instagram')).toHaveValue('uriel.runesdechene')
  expect(screen.getByRole('button', { name: /Chevalier errant/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('une présentation collée trop longue est tronquée à 300, compteur au plein', async () => {
  ouvrir()
  const bio = await screen.findByLabelText('Ta présentation')
  await userEvent.clear(bio)
  await userEvent.click(bio)
  await userEvent.paste('a'.repeat(400))
  expect(bio).toHaveValue('a'.repeat(300))
  expect(screen.getByText('300 / 300').className).toMatch(/plein/)
})

test('un troisième titre ne se coche pas', async () => {
  ouvrir()
  await userEvent.click(await screen.findByRole('button', { name: 'Hoplite' }))
  await userEvent.click(screen.getByRole('button', { name: 'Arpenteur' }))
  expect(screen.getByRole('button', { name: 'Arpenteur' })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByText('Deux au plus')).toBeInTheDocument()
})

test('Enregistrer écrit le profil, les titres changés, l’accord, puis revient', async () => {
  const onTermine = ouvrir()
  const nom = await screen.findByLabelText('Ton nom')
  await userEvent.clear(nom)
  await userEvent.type(nom, 'Uriel L.')
  await userEvent.click(screen.getByRole('button', { name: 'Hoplite' }))
  await userEvent.click(screen.getByRole('button', { name: /Féminin/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(api.enregistrerProfil).toHaveBeenCalledWith({
    nom: 'Uriel L.',
    bio: 'Chevalier errant',
    instagram: 'uriel.runesdechene',
  })
  expect(api.choisirTitres).toHaveBeenCalledWith([1, 2])
  expect(api.choisirAccord).toHaveBeenCalledWith('f')
  expect(onTermine).toHaveBeenCalledOnce()
})

test('un échec : message sous le bouton, saisie conservée', async () => {
  api.enregistrerProfil.mockRejectedValueOnce(new Error('réseau'))
  const onTermine = ouvrir()
  const nom = await screen.findByLabelText('Ton nom')
  await userEvent.type(nom, ' bis')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('n’a pas pu être enregistré')
  expect(nom).toHaveValue('Uriel bis')
  expect(onTermine).not.toHaveBeenCalled()
})

test('titres inchangés : on ne les réécrit pas (la V1 garde les siens)', async () => {
  api.choisirTitres.mockClear()
  const onTermine = ouvrir()
  await userEvent.type(await screen.findByLabelText('Ta présentation'), ' !')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  await waitFor(() => {
    expect(onTermine).toHaveBeenCalled()
  })
  expect(api.choisirTitres).not.toHaveBeenCalled()
})

test('titres illisibles : un message et « Réessayer », jamais un écran vide', async () => {
  api.titresDebloques.mockRejectedValueOnce(new Error('réseau'))
  ouvrir()
  expect(await screen.findByText('Ton profil n’a pas pu être chargé')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
})
