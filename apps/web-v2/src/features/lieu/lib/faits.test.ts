import { expect, test } from 'vitest'
import { ligneDeFaits } from './faits'

const vide = { epoque: null, annee: null }

test('la ligne ne dit que ce qui est connu : l’époque et le siècle', () => {
  expect(ligneDeFaits({ epoque: 'Moyen Âge', annee: 1150 })).toBe('Moyen Âge · XIIᵉ siècle')
  expect(ligneDeFaits({ ...vide, annee: -52 })).toBe('Iᵉʳ siècle av. J.-C.')
})

test('rien de connu : pas de ligne', () => {
  expect(ligneDeFaits(vide)).toBeNull()
})
