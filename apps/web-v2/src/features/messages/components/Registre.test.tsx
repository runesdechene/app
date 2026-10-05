/**
 * QUOI     — le Registre : les messages des canaux cochés, le préfixe du canal quand plusieurs
 *            sont cochés, et l'écriture dans le canal choisi.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import type { Passage } from '../api/lireRegistre'
import { Registre } from './Registre'

const api = vi.hoisted(() => ({
  fetchRegistre: vi.fn(),
  ecrire: vi.fn(),
  ecouterRegistre: vi.fn(() => () => undefined),
  chercherExplorateurs: vi.fn(),
  fetchRegistreNonLus: vi.fn(() => Promise.resolve({ messages: 0, mentions: 0 })),
  marquerRegistreLu: vi.fn(() => Promise.resolve()),
  fetchPassages: vi.fn<() => Promise<Passage[]>>(() => Promise.resolve([])),
  aimerMessage: vi.fn(() => Promise.resolve()),
}))
vi.mock('../api/registre', () => api)
const canaux = vi.hoisted(() => ({
  fetchCanaux: vi.fn(() =>
    Promise.resolve([{ id: 'f-lys', nom: 'Le Lys de Fer', couleur: '#5f6f86' }]),
  ),
}))
vi.mock('@/shared/supabase/canaux', () => canaux)

const URIEL = { id: 'u1', nom: 'Uriel', avatar: null }
const GAUTIER = { id: 'u2', nom: 'Gautier', avatar: null }
const KELPIE = { id: 'u9', nom: 'Kelpie', avatar: null }

// Un message de Gautier, et qui l'a aimé.
function balade(coeurs: (typeof URIEL)[], aime: boolean) {
  const quand = '2026-09-28T07:12:00Z'
  const message = {
    id: 7,
    canal: 'general',
    canalNom: null,
    canalCouleur: null,
    texte: 'Belle balade hier.',
    quand,
    auteur: GAUTIER,
  }
  return { ...message, moi: false, mentions: [], mentionneMoi: false, coeurs, aime }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  api.fetchRegistre.mockResolvedValue([
    {
      id: 1,
      canal: 'general',
      canalNom: null,
      canalCouleur: null,
      texte: 'Il y a du monde ici bas ?',
      quand: '2026-09-28T07:12:00Z',
      auteur: URIEL,
      moi: true,
      mentions: [],
      mentionneMoi: false,
      coeurs: [],
      aime: false,
    },
    {
      id: 2,
      canal: 'bugs',
      canalNom: null,
      canalCouleur: null,
      texte: 'Je ne peux pas planter un lieu.',
      quand: '2026-09-28T07:15:00Z',
      auteur: GAUTIER,
      moi: false,
      mentions: [],
      mentionneMoi: false,
      coeurs: [],
      aime: false,
    },
  ])
  api.ecrire.mockResolvedValue(undefined)
})

function monter(adresse = '/messages') {
  const router = createMemoryRouter([{ path: '*', element: <Registre /> }], {
    initialEntries: [adresse],
  })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

test('chaque message, et le préfixe du canal des bugs', async () => {
  monter()
  const registre = await screen.findByRole('list', { name: 'Registre' })
  expect(await within(registre).findByText(/Il y a du monde ici bas/)).toBeInTheDocument()
  const [, bug] = within(registre).getAllByRole('listitem')
  expect(bug).toHaveTextContent('Gautier [Bug & Suggestions] Je ne peux pas planter un lieu.')
})

test('décocher un canal retire ses messages ; le préfixe « Bug & Suggestions » reste', async () => {
  monter()
  const registre = await screen.findByRole('list', { name: 'Registre' })
  await within(registre).findByText(/Il y a du monde ici bas/)
  await userEvent.click(screen.getByRole('button', { name: /Canal général/ }))
  expect(within(registre).queryByText(/Il y a du monde ici bas/)).toBeNull()
  expect(within(registre).getByRole('listitem')).toHaveTextContent('[Bug & Suggestions]')
})

test('on écrit dans le canal choisi ; le champ se vide', async () => {
  monter()
  await screen.findByRole('list', { name: 'Registre' })
  const canal = screen.getByRole('button', { name: 'Canal : Général' })
  await userEvent.click(canal)
  await userEvent.click(screen.getByRole('option', { name: 'Bugs & suggestions' }))
  expect(screen.queryByRole('listbox')).toBeNull()
  expect(screen.getByRole('button', { name: 'Canal : Bugs & suggestions' })).toBeInTheDocument()
  await userEvent.type(screen.getByRole('textbox', { name: 'Écrire quelque chose' }), '  Merci !  ')
  await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }))
  expect(api.ecrire).toHaveBeenCalledWith('bugs', 'Merci !', [])
  expect(screen.getByRole('textbox', { name: 'Écrire quelque chose' })).toHaveValue('')
})

test('les messages d’affilée d’une même personne se groupent : ni portrait ni nom répétés', async () => {
  api.fetchRegistre.mockResolvedValue([
    {
      id: 1,
      canal: 'general',
      canalNom: null,
      canalCouleur: null,
      texte: 'Toujours.',
      quand: '2026-09-28T07:14:00Z',
      auteur: GAUTIER,
      moi: false,
      mentions: [],
      mentionneMoi: false,
      coeurs: [],
      aime: false,
    },
    {
      id: 2,
      canal: 'bugs',
      canalNom: null,
      canalCouleur: null,
      texte: 'J’en ai marre.',
      quand: '2026-09-28T07:15:00Z',
      auteur: GAUTIER,
      moi: false,
      mentions: [],
      mentionneMoi: false,
      coeurs: [],
      aime: false,
    },
    {
      id: 3,
      canal: 'general',
      canalNom: null,
      canalCouleur: null,
      texte: 'Plus tard.',
      quand: '2026-09-28T07:40:00Z',
      auteur: GAUTIER,
      moi: false,
      mentions: [],
      mentionneMoi: false,
      coeurs: [],
      aime: false,
    },
  ])
  monter()
  const registre = await screen.findByRole('list', { name: 'Registre' })
  const [premier, suite, apresUnSilence] = await within(registre).findAllByRole('listitem')
  expect(premier).toHaveTextContent('Gautier Toujours.')
  expect(suite).toHaveTextContent('[Bug & Suggestions] J’en ai marre.')
  expect(suite).not.toHaveTextContent('Gautier')
  // Vingt-cinq minutes plus tard : un nouveau bloc, avec son nom.
  expect(apresUnSilence).toHaveTextContent('Gautier Plus tard.')
})

test('dans un groupe, le préfixe « Bug & Suggestions » ne s’écrit qu’une fois', async () => {
  const bug = (id: number, minute: number, texte: string) => ({
    id,
    canal: 'bugs',
    canalNom: null,
    canalCouleur: null,
    texte,
    quand: `2026-09-28T07:${String(minute).padStart(2, '0')}:00Z`,
    auteur: GAUTIER,
    moi: false,
    mentions: [],
    mentionneMoi: false,
    coeurs: [],
    aime: false,
  })
  api.fetchRegistre.mockResolvedValue([
    bug(1, 14, 'La carte ne charge pas.'),
    bug(2, 15, 'Même en rechargeant.'),
    bug(3, 16, 'Sur Firefox aussi.'),
  ])
  monter()
  const registre = await screen.findByRole('list', { name: 'Registre' })
  const [premier, deuxieme, troisieme] = await within(registre).findAllByRole('listitem')
  expect(premier).toHaveTextContent('[Bug & Suggestions] La carte ne charge pas.')
  expect(deuxieme).not.toHaveTextContent('[Bug & Suggestions]')
  expect(troisieme).not.toHaveTextContent('[Bug & Suggestions]')
})

test('un séparateur à chaque nouveau jour ; minuit coupe un groupe', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 28, 21, 0))
  const message = (id: number, quand: Date, texte: string) => ({
    id,
    canal: 'general',
    canalNom: null,
    canalCouleur: null,
    texte,
    quand: quand.toISOString(),
    auteur: GAUTIER,
    moi: false,
    mentions: [],
    mentionneMoi: false,
    coeurs: [],
    aime: false,
  })
  api.fetchRegistre.mockResolvedValue([
    message(1, new Date(2026, 8, 27, 23, 58), 'Bonne nuit.'),
    message(2, new Date(2026, 8, 28, 0, 2), 'Ah non, encore une chose.'),
  ])
  monter()
  const registre = await screen.findByRole('list', { name: 'Registre' })
  await within(registre).findByText(/encore une chose/)
  const jours = within(registre).getAllByRole('separator')
  expect(jours.map((j) => j.textContent)).toEqual(['Hier', 'Aujourd’hui'])
  // Quatre minutes d'écart, mais pas le même jour : le nom revient.
  expect(within(registre).getAllByRole('listitem')[1]).toHaveTextContent('Gautier Ah non')
  vi.useRealTimers()
})

test('« @ » puis le début d’un nom propose des Explorateurs ; le choisir le mentionne', async () => {
  api.chercherExplorateurs.mockResolvedValue([
    { id: 'u2', nom: 'Gautier de Bilskimir', avatar: null },
  ])
  monter()
  await screen.findByRole('list', { name: 'Registre' })
  const champ = screen.getByRole('textbox', { name: 'Écrire quelque chose' })
  await userEvent.type(champ, 'Salut @Gau')
  const proposition = await screen.findByRole('option', { name: /Gautier de Bilskimir/ })
  fireEvent.pointerDown(proposition)
  expect(champ).toHaveValue('Salut @Gautier de Bilskimir ')
  expect(screen.queryByRole('listbox', { name: 'Mentionner' })).toBeNull()
  // Une lettre tapée aussitôt : une image plus tard, le curseur est toujours derrière elle.
  fireEvent.change(champ, { target: { value: 'Salut @Gautier de Bilskimir t' } })
  await new Promise(requestAnimationFrame)
  expect((champ as HTMLInputElement).selectionStart).toBe('Salut @Gautier de Bilskimir t'.length)
  await userEvent.type(champ, 'u as vu ?')
  await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }))
  expect(api.ecrire).toHaveBeenCalledWith('general', 'Salut @Gautier de Bilskimir tu as vu ?', [
    'u2',
  ])
})

test('au clavier : les flèches choisissent dans la liste, Entrée mentionne sans envoyer', async () => {
  api.chercherExplorateurs.mockResolvedValue([
    { id: 'u2', nom: 'Le Barde', avatar: null },
    { id: 'u3', nom: 'Le Marcheur de Plumes', avatar: null },
  ])
  monter()
  await screen.findByRole('list', { name: 'Registre' })
  const champ = screen.getByRole('textbox', { name: 'Écrire quelque chose' })
  await userEvent.type(champ, '@le')
  await screen.findByRole('option', { name: /Le Marcheur de Plumes/ })
  expect(screen.getByRole('option', { name: /Le Barde/ })).toHaveAttribute('aria-selected', 'true')
  await userEvent.keyboard('{ArrowDown}')
  expect(screen.getByRole('option', { name: /Le Marcheur/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await userEvent.keyboard('{Enter}')
  expect(champ).toHaveValue('@Le Marcheur de Plumes ')
  expect(api.ecrire).not.toHaveBeenCalled()
  await userEvent.type(champ, '@le')
  await screen.findByRole('listbox', { name: 'Mentionner' })
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('listbox', { name: 'Mentionner' })).toBeNull()
})

test('les arrivées s’écrivent dans le canal général, discrètes et sans portrait ; plus de connexions', async () => {
  api.fetchPassages.mockResolvedValue([
    { id: 'arrivee:u9', type: 'arrivee', quand: '2026-09-28T07:13:00Z', qui: KELPIE, moi: false },
  ])
  monter()
  const registre = await screen.findByRole('list', { name: 'Registre' })
  const arrivee = (await within(registre).findByText(/a rejoint EXPLORE/)).closest('li')
  if (!arrivee) throw new Error('ligne absente')
  expect(arrivee).toHaveTextContent('Kelpie a rejoint EXPLORE !')
  expect(within(arrivee).queryByRole('button')).toBeNull()
  expect(within(arrivee).queryByRole('img')).toBeNull()
  // Les arrivées vivent dans « Activité » : le canal général décoché ne les retire pas,
  // « Activité » décochée, si.
  await userEvent.click(screen.getByRole('button', { name: /Canal général/ }))
  expect(within(registre).getByText(/a rejoint EXPLORE/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Activité/ }))
  expect(within(registre).queryByText(/a rejoint EXPLORE/)).toBeNull()
})

test('une mention s’affiche en lien vers le profil ; un message qui me mentionne se distingue', async () => {
  api.fetchRegistre.mockResolvedValue([
    {
      id: 9,
      canal: 'general',
      canalNom: null,
      canalCouleur: null,
      texte: '@Uriel tu passes samedi ?',
      quand: '2026-09-28T07:12:00Z',
      auteur: GAUTIER,
      moi: false,
      mentions: [{ id: 'u1', nom: 'Uriel' }],
      mentionneMoi: true,
      coeurs: [],
      aime: false,
    },
  ])
  monter()
  const lien = await screen.findByRole('link', { name: '@Uriel' })
  expect(lien).toHaveAttribute('href', '/messages/explorateur/u1')
  expect(lien.closest('li')?.className).toMatch(/mentionne/)
})

test('le Registre ouvert est lu : le marqueur avance', async () => {
  api.marquerRegistreLu.mockClear()
  monter()
  await vi.waitFor(() => {
    expect(api.marquerRegistreLu).toHaveBeenCalled()
  })
})

test('aimer un message passe par la base : un cœur, puis le Registre se relit', async () => {
  api.fetchRegistre.mockResolvedValue([balade([], false)])
  monter()
  const coeur = await screen.findByRole('button', { name: 'Aimer le message de Gautier' })
  api.fetchRegistre.mockResolvedValue([balade([URIEL], true)])
  await userEvent.click(coeur)
  expect(api.aimerMessage).toHaveBeenCalledWith(7, true)
  expect(await screen.findByRole('button', { name: 'Voir qui a aimé (1)' })).toBeInTheDocument()
})

test('des arrivées d’affilée : une seule ligne, sans bouton de bienvenue', async () => {
  const ASH = { id: 'u8', nom: 'Ash', avatar: null }
  api.fetchPassages.mockResolvedValue([
    { id: 'arrivee:u9', type: 'arrivee', quand: '2026-09-28T07:13:00Z', qui: KELPIE, moi: false },
    { id: 'arrivee:u8', type: 'arrivee', quand: '2026-09-28T07:14:00Z', qui: ASH, moi: false },
  ])
  monter()
  const registre = await screen.findByRole('list', { name: 'Registre' })
  const groupe = (await within(registre).findByText(/ont rejoint EXPLORE/)).closest('li')
  if (!groupe) throw new Error('ligne absente')
  expect(groupe).toHaveTextContent('Kelpie et Ash ont rejoint EXPLORE !')
  expect(within(groupe).queryByRole('button')).toBeNull()
})

test('un canal décoché le reste à la prochaine ouverture ; « Activité » ne s’écrit pas', async () => {
  monter()
  await userEvent.click(await screen.findByRole('button', { name: /Activité/ }))
  expect(screen.getByRole('button', { name: /Activité/ })).toHaveAttribute('aria-pressed', 'false')
  cleanup()
  monter()
  expect(await screen.findByRole('button', { name: /Activité/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await userEvent.click(screen.getByRole('button', { name: /^Canal :/ }))
  expect(screen.queryByRole('option', { name: /Activité/ })).toBeNull()
})

test('mes Compagnies sont des gélules à leur couleur, cochées d’office', async () => {
  monter()
  const g = await screen.findByRole('button', { name: 'Le Lys de Fer' })
  expect(g).toHaveAttribute('aria-pressed', 'true')
  expect(g.style.getPropertyValue('--couleur')).toBe('#5f6f86')
  expect(screen.getByRole('link', { name: /Compagnies/ })).toHaveAttribute(
    'href',
    '/messages/compagnies',
  )
})

test('écrire dans une Compagnie : le champ le dit, et le message part dans son canal', async () => {
  monter()
  await screen.findByRole('button', { name: 'Le Lys de Fer' })
  await userEvent.click(screen.getByRole('button', { name: 'Canal : Général' }))
  await userEvent.click(screen.getByRole('option', { name: 'Le Lys de Fer' }))
  const champ = screen.getByRole('textbox', { name: 'Écrire au Lys de Fer' })
  await userEvent.type(champ, 'On monte à Joux ?')
  await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }))
  expect(api.ecrire).toHaveBeenCalledWith('f-lys', 'On monte à Joux ?', [])
})

test('« Ouvrir le canal » d’une Compagnie : ?canal coche sa gélule et la choisit', async () => {
  localStorage.setItem(
    'explore-v2:registre:filtres',
    JSON.stringify({ coches: ['general'], connus: ['general', 'bugs', 'activite', 'f-lys'] }),
  )
  monter('/messages?canal=f-lys')
  expect(await screen.findByRole('textbox', { name: 'Écrire au Lys de Fer' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Le Lys de Fer' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})
