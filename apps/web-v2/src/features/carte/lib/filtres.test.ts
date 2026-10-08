/**
 * QUOI     — les filtres de la carte : la progression, les natures (l'une ou l'autre), les
 *            époques (l'une ou l'autre), cumulés ; un lieu sans époque compte comme « Indéfinie ».
 */
import { expect, test } from 'vitest'
import type { LieuCarte } from '../api/lireCarte'
import { compterNatures, filtrer, FILTRES_VIDES, filtresActifs } from './filtres'

function lieu(l: Partial<LieuCarte>): LieuCarte {
  return {
    id: 'x',
    nom: 'Lieu',
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
    ...l,
  }
}

const CHATEAU = lieu({ id: 'c', natures: ['chateau'], epoque: 'late-middle-ages', etat: 'visite' })
const SOURCE = lieu({ id: 's', natures: ['source', 'naturel'], epoque: 'not-applicable' })
const DOLMEN = lieu({ id: 'd', natures: ['dolmen'], epoque: null, etat: 'connu', ajoute: true })
const TOUS = [CHATEAU, SOURCE, DOLMEN]
const ids = (l: LieuCarte[]) => l.map((x) => x.id)

test('sans filtre, tout passe ; rien n’est actif', () => {
  expect(ids(filtrer(TOUS, FILTRES_VIDES))).toEqual(['c', 's', 'd'])
  expect(filtresActifs(FILTRES_VIDES)).toBe(false)
})

test('la progression : à découvrir, visités, ajoutés', () => {
  expect(ids(filtrer(TOUS, { ...FILTRES_VIDES, progression: 'aDecouvrir' }))).toEqual(['s'])
  expect(ids(filtrer(TOUS, { ...FILTRES_VIDES, progression: 'visites' }))).toEqual(['c'])
  expect(ids(filtrer(TOUS, { ...FILTRES_VIDES, progression: 'ajoutes' }))).toEqual(['d'])
})

test('les natures : un lieu passe s’il a l’une d’elles, même en seconde nature', () => {
  const f = { ...FILTRES_VIDES, natures: new Set(['naturel', 'dolmen']) }
  expect(ids(filtrer(TOUS, f))).toEqual(['s', 'd'])
  expect(filtresActifs(f)).toBe(true)
})

test('les époques : sans époque, un lieu compte comme « Indéfinie »', () => {
  expect(ids(filtrer(TOUS, { ...FILTRES_VIDES, epoques: new Set(['unknown']) }))).toEqual(['d'])
  expect(
    ids(
      filtrer(TOUS, { ...FILTRES_VIDES, epoques: new Set(['late-middle-ages', 'not-applicable']) }),
    ),
  ).toEqual(['c', 's'])
})

test('les filtres se cumulent', () => {
  const f = {
    progression: 'visites' as const,
    natures: new Set(['chateau']),
    epoques: new Set(['renaissance']),
    fragments: true,
  }
  expect(filtrer(TOUS, f)).toEqual([])
})

test('le nombre de lieux de chaque nature', () => {
  expect(compterNatures(TOUS)).toEqual(
    new Map([
      ['chateau', 1],
      ['source', 1],
      ['naturel', 1],
      ['dolmen', 1],
    ]),
  )
})

test('les Fragments sont montrés par défaut ; les masquer compte comme un filtre actif', () => {
  expect(FILTRES_VIDES.fragments).toBe(true)
  expect(filtresActifs({ ...FILTRES_VIDES, fragments: false })).toBe(true)
})
