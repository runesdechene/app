import { expect, test } from 'vitest'
import { BROUILLON_VIDE, ceQuiManque, derniereEtapePossible, type Brouillon } from './brouillon'

const photo = { id: 'p1', grande: new Blob(), vignette: new Blob() }
const complet: Brouillon = {
  ...BROUILLON_VIDE,
  photos: [photo],
  point: { latitude: 43.7, longitude: 7.2 },
  nom: 'Château de Colomars',
  natures: ['3fQyu5KCU'],
  recit: 'Une tour carrée.',
}

test('ce qui manque se dit, étape par étape', () => {
  expect(ceQuiManque(BROUILLON_VIDE, 'photo')).toBe('Une photo, au moins')
  expect(ceQuiManque({ ...complet, point: null }, 'lieu')).toBe('Place le lieu sur la carte')
  expect(ceQuiManque({ ...complet, nom: '  ' }, 'nom')).toBe('Il lui faut un nom')
  expect(ceQuiManque({ ...complet, natures: [] }, 'nom')).toBe('Choisis sa nature')
  expect(ceQuiManque({ ...complet, recit: '' }, 'recit')).toBe('Quelques mots, au moins')
  expect(ceQuiManque(complet, 'recit')).toBeNull()
})

test('on ne va pas plus loin que la première étape incomplète', () => {
  expect(derniereEtapePossible(BROUILLON_VIDE)).toBe('photo')
  expect(derniereEtapePossible({ ...complet, point: null })).toBe('lieu')
  expect(derniereEtapePossible({ ...complet, natures: [] })).toBe('nom')
  expect(derniereEtapePossible({ ...complet, recit: '' })).toBe('recit')
  expect(derniereEtapePossible(complet)).toBe('apercu')
})
