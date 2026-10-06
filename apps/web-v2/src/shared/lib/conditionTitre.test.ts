/**
 * QUOI     — la phrase qui dit comment un titre a été gagné, depuis `titles.condition`.
 */
import { lireCondition, phraseCondition } from './conditionTitre'

test('les hauts faits se disent en une phrase', () => {
  expect(phraseCondition({ stat: 'places_visited', min: 50 })).toBe(
    'Débloqué en visitant 50 lieux sur place.',
  )
  expect(phraseCondition({ stat: 'level', min: 10 })).toBe('Débloqué en atteignant le niveau 10.')
  expect(phraseCondition({ stat: 'places_added', min: 1 })).toBe('Débloqué en ajoutant 1 lieu.')
})

test('un titre sans seuil est offert à l’arrivée', () => {
  expect(phraseCondition({ stat: 'discoveries', min: 0 })).toBe(
    'Offert à chaque nouvel Explorateur.',
  )
})

test('une condition inconnue ou absente reste honnête', () => {
  expect(phraseCondition({ stat: 'nouveau_truc', min: 3 })).toBe('Gagné en jouant.')
  expect(phraseCondition(null)).toBe('Gagné en jouant.')
})

test('enrichir des lieux se dit aussi', () => {
  expect(phraseCondition({ stat: 'places_enriched', min: 10 })).toBe(
    'Débloqué en enrichissant 10 lieux.',
  )
  expect(phraseCondition({ stat: 'places_enriched', min: 1 })).toBe(
    'Débloqué en enrichissant 1 lieu.',
  )
})

test('une condition se lit depuis la base, ou devient null si elle est illisible', () => {
  expect(lireCondition({ stat: 'plantages', min: 30 })).toEqual({ stat: 'plantages', min: 30 })
  expect(lireCondition({ stat: 'plantages' })).toBeNull()
  expect(lireCondition(null)).toBeNull()
})
