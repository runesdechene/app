import { ecart } from './ecart'

test('sans période d’avant comparable, pas d’écart', () => {
  expect(ecart(312, undefined)).toBeUndefined()
})
test('rien avant, quelque chose maintenant : « nouveau », jamais l’infini', () => {
  expect(ecart(5, 0)).toEqual({ texte: 'nouveau', sens: 'hausse' })
})
test('rien avant, rien maintenant : égal', () => {
  expect(ecart(0, 0)).toEqual({ texte: '=', sens: 'egal' })
})
test('petits nombres : l’écart en valeur', () => {
  expect(ecart(9, 6)).toEqual({ texte: '+3', sens: 'hausse' })
  expect(ecart(4, 6)).toEqual({ texte: '−2', sens: 'baisse' })
})
test('grands nombres : l’écart en pourcentage arrondi', () => {
  expect(ecart(24, 20)).toEqual({ texte: '+20 %', sens: 'hausse' })
  expect(ecart(300, 312)).toEqual({ texte: '−4 %', sens: 'baisse' })
})
test('même valeur : égal', () => {
  expect(ecart(40, 40)).toEqual({ texte: '=', sens: 'egal' })
})
