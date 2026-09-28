import { expect, test } from 'vitest'
import { ligneDeFaits } from './faits'

const vide = { epoque: null, annee: null, saison: null, acces: null, bivouac: null }

test('la ligne ne dit que ce qui est connu', () => {
  expect(ligneDeFaits({ ...vide, epoque: 'Moyen Âge', annee: 1150, acces: 'easy' })).toBe('Moyen Âge · XIIᵉ siècle · accès facile')
  expect(ligneDeFaits({ ...vide, annee: -52 })).toBe('Iᵉʳ siècle av. J.-C.')
})

test('rien de connu : pas de ligne', () => {
  expect(ligneDeFaits(vide)).toBeNull()
})
