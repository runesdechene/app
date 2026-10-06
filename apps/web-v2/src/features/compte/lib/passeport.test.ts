/**
 * QUOI     — les regroupements du passeport : par nature, par territoire, par mois.
 */
import { expect, test } from 'vitest'
import type { Nature, Tampon } from '../api/lirePasseport'
import {
  AILLEURS,
  comptes,
  encre,
  enDate,
  parMois,
  parNature,
  parTerritoire,
  territoireDe,
} from './passeport'

const N = (id: string): Nature => ({
  id,
  nom: id,
  icone: `https://x/${id}.svg`,
  couleur: '#000000',
})
const T = (id: string, quand: string, o: Partial<Tampon> = {}): Tampon => ({
  id,
  nom: id,
  imageUrl: null,
  nature: 'chateau',
  departement: 'Alpes-Maritimes',
  pays: 'France',
  quand,
  ...o,
})

test('encre : 1 pâle, 2 à 9 moyen, 10 et plus fort', () => {
  expect([1, 2, 9, 10, 42].map(encre)).toEqual(['pale', 'moyen', 'moyen', 'fort', 'fort'])
})

test('par nature : toutes les natures, comptées, jamais visitées sans encre', () => {
  const r = parNature([N('chateau'), N('source')], [T('a', '2026-10-01'), T('b', '2026-09-01')])
  expect(r.map((x) => [x.nature.id, x.compte, x.encre])).toEqual([
    ['chateau', 2, 'moyen'],
    ['source', 0, null],
  ])
})

test('par nature : un tampon sans nature ne compte nulle part', () => {
  expect(parNature([N('chateau')], [T('a', '2026-10-01', { nature: null })])[0]?.compte).toBe(0)
})

test('territoire : département, sinon pays, sinon Ailleurs', () => {
  expect(territoireDe(T('a', '2026-10-01'))).toBe('Alpes-Maritimes')
  expect(territoireDe(T('a', '2026-10-01', { departement: null, pays: 'Italie' }))).toBe('Italie')
  expect(territoireDe(T('a', '2026-10-01', { departement: null, pays: null }))).toBe(AILLEURS)
})

test("par territoire : le plus récemment tamponné d'abord, tampons récents d'abord", () => {
  const r = parTerritoire([
    T('a', '2026-10-06'),
    T('b', '2026-10-01', { departement: null, pays: 'Italie' }),
    T('c', '2026-09-01'),
  ])
  expect(r.map((t) => [t.nom, t.tampons.map((x) => x.id)])).toEqual([
    ['Alpes-Maritimes', ['a', 'c']],
    ['Italie', ['b']],
  ])
})

test("par mois : le plus récent d'abord", () => {
  const r = parMois([T('a', '2026-10-06'), T('b', '2026-09-28'), T('c', '2026-10-01')])
  expect(r.map((m) => [m.cle, m.tampons.map((x) => x.id)])).toEqual([
    ['2026-10', ['a', 'c']],
    ['2026-09', ['b']],
  ])
})

test('comptes : départements distincts, pays distincts (France comprise)', () => {
  expect(
    comptes([
      T('a', '2026-10-01'),
      T('b', '2026-10-01', { departement: 'Var' }),
      T('c', '2026-10-01', { departement: null, pays: 'Italie' }),
      T('d', '2026-10-01', { departement: null, pays: null }),
    ]),
  ).toEqual({ departements: 2, pays: 2 })
})

test('enDate : le jour donné, sans décalage de fuseau', () => {
  const d = enDate('2026-10-01')
  expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 1])
})
