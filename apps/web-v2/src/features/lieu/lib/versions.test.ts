/**
 * QUOI     — ce qu'une version a changé, en mots.
 */
import { expect, test } from 'vitest'
import type { Version } from '../api/lireLieu'
import { ceQuiAChange } from './versions'

const v = (champs: string[], origine = false): Version => ({
  id: 1,
  quand: '2026-09-30T08:00:00Z',
  origine,
  champs,
  note: null,
  qui: null,
})

test('une version se dit en mots', () => {
  expect(ceQuiAChange(v([], true))).toBe('a ajouté le lieu')
  expect(ceQuiAChange(v(['recit']))).toBe('a enrichi le récit')
  expect(ceQuiAChange(v(['nom']))).toBe('a changé le nom')
  expect(ceQuiAChange(v(['natures', 'epoque']))).toBe('a changé la nature et l’époque')
  expect(ceQuiAChange(v(['nom', 'natures', 'recit']))).toBe(
    'a changé le nom, la nature et le récit',
  )
})

test('les rubriques et le bivouac se disent aussi', () => {
  expect(ceQuiAChange(v(['acces']))).toBe('a enrichi l’accès')
  expect(ceQuiAChange(v(['bon_a_savoir']))).toBe('a enrichi « Bon à savoir »')
  expect(ceQuiAChange(v(['quand', 'recit']))).toBe('a enrichi « Quand y aller » et le récit')
  expect(ceQuiAChange(v(['bivouac']))).toBe('a changé le bivouac')
  expect(ceQuiAChange(v(['nom', 'acces']))).toBe('a changé le nom et l’accès')
})
