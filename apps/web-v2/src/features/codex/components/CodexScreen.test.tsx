/**
 * QUOI     — la page du Codex (maquette F) : le compte, les filtres, une section par collection.
 * POURQUOI — spec du Codex (02/11) : repliée si l'on n'y a rien, le titre d'une collection
 *            complète, une page vide qui dit quoi faire.
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import type { Codex, FragmentDuCodex } from '../api/lireCodex'
import { CodexScreen } from './CodexScreen'

const etat = vi.hoisted(() => ({ codex: undefined as Codex | undefined }))
vi.mock('../hooks/useCodex', () => ({
  useCodex: () => ({ codex: etat.codex, erreur: false, reessayer: vi.fn() }),
}))

const f = (id: number, nom: string, e: FragmentDuCodex['etat']): FragmentDuCodex => ({
  id,
  nom,
  illustration: null,
  etat: e,
  scans: e === 'scanne' ? 2 : 0,
  numero: e === 'porte' ? id : null,
  nouveau: false,
  edition: null,
  editionPrecision: null,
})

const plein: Codex = {
  totaux: { portes: 6, scannes: 2, inconnus: 2, total: 10 },
  collections: [
    {
      heritage: 'Le Pacte Sauvage',
      nom: 'Le Pacte Sauvage',
      couleur: '#406b45',
      icone: null,
      titre: 'Gardien du Pacte',
      portes: 2,
      total: 2,
      fragments: [f(1, 'Loup', 'porte'), f(2, 'Hibou', 'porte')],
    },
    {
      heritage: 'Les mystères celtes',
      nom: 'Les mystères celtes',
      couleur: null,
      icone: null,
      titre: 'Initié du Nemeton',
      portes: 1,
      total: 3,
      fragments: [f(3, 'Druide', 'porte'), f(4, 'Morrigan', 'scanne'), f(5, 'Avalon', 'inconnu')],
    },
    {
      heritage: 'La Garde d’Acier',
      nom: 'La Garde d’Acier',
      couleur: null,
      icone: null,
      titre: null,
      portes: 0,
      total: 4,
      fragments: [
        f(6, 'Valkyrie', 'inconnu'),
        f(7, 'Huscarl', 'inconnu'),
        f(8, 'Berserker', 'inconnu'),
        f(9, 'Skald', 'inconnu'),
      ],
    },
  ],
}

test('une petite collection où l’on n’a rien s’ouvre quand même : repliée, elle paraît vide', () => {
  afficher({
    totaux: { portes: 0, scannes: 0, inconnus: 1, total: 1 },
    collections: [
      {
        heritage: null,
        nom: 'Hors collection',
        couleur: null,
        icone: null,
        titre: null,
        portes: 0,
        total: 1,
        fragments: [f(14, 'Jeanne de Flandre', 'inconnu')],
      },
    ],
  })
  const tete = within(screen.getByRole('region', { name: 'Hors collection' })).getAllByRole(
    'button',
  )[0]
  expect(tete).toHaveAttribute('aria-expanded', 'true')
})

function afficher(codex: Codex) {
  etat.codex = codex
  render(
    <MemoryRouter>
      <CodexScreen />
    </MemoryRouter>,
  )
}

test('le compte total', () => {
  afficher(plein)
  expect(screen.getByText('Fragments portés')).toBeInTheDocument()
  expect(screen.getByText('2 scannés · 2 inconnus')).toBeInTheDocument()
})

test('une collection où l’on n’a rien est repliée, les autres dépliées', () => {
  afficher(plein)
  const tete = (nom: string) =>
    within(screen.getByRole('region', { name: nom })).getAllByRole('button')[0]
  expect(tete('La Garde d’Acier')).toHaveAttribute('aria-expanded', 'false')
  expect(tete('Les mystères celtes')).toHaveAttribute('aria-expanded', 'true')
  expect(screen.queryByText('Valkyrie')).toBeNull()
})

test('une collection complète montre son titre, une autre le titre à gagner', () => {
  afficher(plein)
  expect(screen.getByText('Titre obtenu : « Gardien du Pacte »')).toBeInTheDocument()
  expect(
    screen.getByText('Porte les 3 pour gagner le titre « Initié du Nemeton »'),
  ).toBeInTheDocument()
})

test('filtrer une collection n’affiche qu’elle', async () => {
  afficher(plein)
  const filtres = screen.getByRole('group', { name: 'Trier par collection' })
  await userEvent.click(within(filtres).getByRole('button', { name: /Le Pacte Sauvage/ }))
  expect(screen.getByText('Loup')).toBeInTheDocument()
  expect(screen.queryByText('Druide')).toBeNull()
  await userEvent.click(within(filtres).getByRole('button', { name: 'Toutes' }))
  expect(screen.getByText('Druide')).toBeInTheDocument()
})

test('un Fragment ouvre sa fiche', () => {
  afficher(plein)
  expect(screen.getByRole('link', { name: /Druide/ })).toHaveAttribute('href', '/codex/fragment/3')
})

test('un Codex vide dit quoi faire', () => {
  afficher({
    totaux: { portes: 0, scannes: 0, inconnus: 1, total: 1 },
    collections: [
      {
        heritage: 'La Garde d’Acier',
        nom: 'La Garde d’Acier',
        couleur: null,
        icone: null,
        titre: null,
        portes: 0,
        total: 1,
        fragments: [f(6, 'Valkyrie', 'inconnu')],
      },
    ],
  })
  expect(screen.getByText(/Scanne ton premier Fragment/)).toBeInTheDocument()
})

test('un Fragment inconnu n’ouvre rien : on le découvre en le scannant', () => {
  afficher(plein)
  expect(screen.queryByRole('link', { name: /Avalon|\?\?\?/ })).toBeNull()
})

test('« Comment ça marche ? », sous le titre, ouvre la feuille : la boutique, le scan', async () => {
  afficher(plein)
  await userEvent.click(screen.getByRole('button', { name: 'Comment ça marche ?' }))
  const feuille = screen.getByRole('dialog', { name: 'Comment ça marche ?' })
  expect(within(feuille).getByRole('link', { name: 'Voir la boutique' })).toHaveAttribute(
    'href',
    'https://runesdechene.com',
  )
  expect(within(feuille).getByRole('button', { name: 'Scanner un t-shirt' })).toBeInTheDocument()
})
