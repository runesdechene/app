import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import type { Compagnon, Conquete } from '../api/lireLieu'
import { PlanteTonEtendard } from './PlanteTonEtendard'

const revendication_ = vi.hoisted(() => vi.fn())
vi.mock('../hooks/useRevendication', () => ({ useRevendication: revendication_ }))

const PRIS: Conquete = { nom: 'La Garde du Comté', prisA: 'Remy', rang: 4 }
const revendiquer = vi.fn((): Promise<Conquete> => Promise.resolve(PRIS))
const onConquis = vi.fn()
const onFermer = vi.fn()
const jouer = vi.spyOn(window.HTMLMediaElement.prototype, 'play')

const GARDE = { id: 'c1', nom: 'La Garde du Comté', couleur: '#a94842' }
const VEILLEURS = { id: 'c2', nom: 'Les Veilleurs de l’Estérel', couleur: '#46493c' }
const REMY: Compagnon = { id: 'b', nom: 'Rémy', avatar: null, distance: 40 }

beforeEach(() => {
  revendiquer.mockClear()
  onConquis.mockClear()
  jouer.mockReset().mockResolvedValue(undefined)
})

function afficher({
  compagnons = [],
  erreur = null,
}: { compagnons?: Compagnon[]; erreur?: string | null } = {}) {
  revendication_.mockReturnValue({
    compagnons,
    compagnies: [GARDE, VEILLEURS],
    revendiquer,
    enCours: false,
    erreur,
  })
  render(
    <PlanteTonEtendard
      fiche={{ id: 'a', nom: 'Château de Coaraze' }}
      monNom="Uriel"
      onConquis={onConquis}
      onFermer={onFermer}
    />,
  )
}

const champ = () => screen.getByLabelText('Nom de ta revendication')
const planter = () => screen.getByRole('button', { name: 'Planter mon étendard' })

test('le champ porte mon nom ; les pastilles : mon nom puis mes Compagnies', () => {
  afficher()
  expect(champ()).toHaveValue('Uriel')
  for (const nom of ['Uriel', 'La Garde du Comté', 'Les Veilleurs de l’Estérel'])
    expect(screen.getByRole('button', { name: nom })).toBeInTheDocument()
})

test('seul, mon nom : envoyé tel quel, sans Compagnie, et le bruitage part', async () => {
  afficher()
  await userEvent.click(planter())
  expect(jouer).toHaveBeenCalledOnce()
  expect(revendiquer).toHaveBeenCalledWith([], 'Uriel', null)
  expect(onConquis).toHaveBeenCalledWith(PRIS)
})

test('la pastille d’une Compagnie remplit le champ et revendique pour elle', async () => {
  afficher()
  await userEvent.click(screen.getByRole('button', { name: 'La Garde du Comté' }))
  expect(champ()).toHaveValue('La Garde du Comté')
  await userEvent.click(planter())
  expect(revendiquer).toHaveBeenCalledWith([], 'La Garde du Comté', 'c1')
})

test('retoucher le nom à la main fait tomber le « pour »', async () => {
  afficher()
  await userEvent.click(screen.getByRole('button', { name: 'La Garde du Comté' }))
  await userEvent.type(champ(), ' — Uriel')
  await userEvent.click(planter())
  expect(revendiquer).toHaveBeenCalledWith([], 'La Garde du Comté — Uriel', null)
})

test('seul, champ vidé : mon nom par défaut (le serveur le met)', async () => {
  afficher()
  await userEvent.clear(champ())
  await userEvent.click(planter())
  expect(revendiquer).toHaveBeenCalledWith([], null, null)
})

test('un nom trop long est coupé à 40 caractères', async () => {
  afficher()
  await userEvent.clear(champ())
  await userEvent.type(champ(), 'x'.repeat(41))
  expect(champ()).toHaveValue('x'.repeat(40))
})

test('sans personne autour, pas de ligne « Avec toi »', () => {
  afficher()
  expect(screen.queryByText('Avec toi')).not.toBeInTheDocument()
})

test('des Explorateurs autour : décochés ; en cocher un exige un nom de groupe', async () => {
  afficher({ compagnons: [REMY] })
  const case_ = screen.getByRole('checkbox', { name: /Rémy/ })
  expect(case_).not.toBeChecked()
  await userEvent.click(case_)
  expect(champ()).toHaveValue('')
  expect(screen.queryByRole('button', { name: 'Uriel' })).not.toBeInTheDocument()
  expect(planter()).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'La Garde du Comté' }))
  await userEvent.click(planter())
  expect(revendiquer).toHaveBeenCalledWith(['b'], 'La Garde du Comté', 'c1')
})

test('un double toucher n’envoie qu’une revendication', async () => {
  revendiquer.mockReturnValueOnce(new Promise<Conquete>(() => undefined))
  afficher()
  await userEvent.dblClick(planter())
  expect(revendiquer).toHaveBeenCalledOnce()
})

test('un refus du serveur : on reste sur l’écran, le message s’affiche', async () => {
  revendiquer.mockRejectedValueOnce(new Error('Pas sur place'))
  afficher({ erreur: 'Tu n’es plus sur place : reviens près du lieu pour le revendiquer.' })
  await userEvent.click(planter())
  expect(screen.getByRole('alert')).toHaveTextContent('Tu n’es plus sur place')
  expect(onConquis).not.toHaveBeenCalled()
  expect(planter()).toBeEnabled()
})

test('« Pas maintenant » revient à la carte', async () => {
  afficher()
  await userEvent.click(screen.getByRole('button', { name: 'Pas maintenant — revenir à la carte' }))
  expect(onFermer).toHaveBeenCalledOnce()
})

test('un refus du serveur coupe le bruitage', async () => {
  const couper = vi
    .spyOn(window.HTMLMediaElement.prototype, 'pause')
    .mockImplementation(() => undefined)
  revendiquer.mockRejectedValueOnce(new Error('Pas sur place'))
  afficher({ erreur: null })
  await userEvent.click(planter())
  expect(couper).toHaveBeenCalledOnce()
})
