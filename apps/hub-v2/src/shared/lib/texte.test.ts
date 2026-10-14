import { pluriel, texteEnClair } from './texte'

test('retire les accolades des dates', () => {
  expect(texteEnClair('En {52 av. J.-C.}, César…')).toBe('En 52 av. J.-C., César…')
})

test('pluriel : singulier jusqu’à 1, pluriel au-delà', () => {
  expect(pluriel(0, 'lieu')).toBe('lieu')
  expect(pluriel(1, 'lieu')).toBe('lieu')
  expect(pluriel(2, 'lieu')).toBe('lieus')
  expect(pluriel(2, 'cheval', 'chevaux')).toBe('chevaux')
})
