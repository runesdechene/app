import { expect, test } from 'vitest'
import { ligneDeFaits } from './faits'

const vide = { epoque: null, annee: null }

test('la ligne ne dit que ce qui est connu : l’époque et le siècle', () => {
  expect(ligneDeFaits({ epoque: 'Moyen Âge', annee: 1150 }, 'chretien')).toBe('Moyen Âge · XIIᵉ siècle')
  expect(ligneDeFaits({ ...vide, annee: -52 }, 'chretien')).toBe('Iᵉʳ siècle av. J.-C.')
})

test('le siècle dans le calendrier choisi', () => {
  expect(ligneDeFaits({ epoque: 'Antiquité', annee: -52 }, 'moderne')).toBe('Antiquité · Iᵉʳ siècle av. è. c.')
  expect(ligneDeFaits({ epoque: 'Antiquité', annee: -52 }, 'rome')).toBe(
    'Antiquité · VIIIᵉ siècle ap. la fondation de Rome',
  )
  expect(ligneDeFaits({ ...vide, annee: 1515 }, 'constantinople')).toBe('Iᵉʳ siècle ap. la chute de Constantinople')
})

test('rien de connu : pas de ligne', () => {
  expect(ligneDeFaits(vide, 'rome')).toBeNull()
})
