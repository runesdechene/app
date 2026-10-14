import { conditionModifiable, genreDeTitre, lireCondition } from './titre'
import type { Json } from '@/shared/supabase/database.types'

const titre = (type: string, condition: Json) => ({ type, condition })

test('le genre d’un titre se lit dans sa condition', () => {
  expect(genreDeTitre(titre('general', { stat: 'level', min: 5 }))).toBe('chemin')
  expect(genreDeTitre(titre('general', { stat: 'connaissance', theme: 'nordique', palier: 3 }))).toBe('connaissance')
  expect(genreDeTitre(titre('general', { stat: 'polymathe' }))).toBe('polymathe')
  expect(genreDeTitre(titre('general', { stat: 'plantages', min: 3 }))).toBe('autre')
  expect(genreDeTitre(titre('general', null))).toBe('autre')
})

test('seul un titre de chemin a une condition modifiable', () => {
  expect(conditionModifiable(titre('general', { stat: 'places_added', min: 2 }))).toBe(true)
  expect(conditionModifiable(titre('general', { stat: 'connaissance', theme: 'x', palier: 1 }))).toBe(false)
  expect(conditionModifiable(titre('general', { stat: 'polymathe' }))).toBe(false)
})

test('lireCondition ignore ce qui n’est pas du bon type', () => {
  expect(lireCondition({ stat: 'level', min: 'x' })).toEqual({ stat: 'level' })
  expect(lireCondition(['a'])).toEqual({})
})
