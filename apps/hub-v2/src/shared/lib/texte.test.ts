import { texteEnClair } from './texte'

test('retire les accolades des dates', () => {
  expect(texteEnClair('En {52 av. J.-C.}, César…')).toBe('En 52 av. J.-C., César…')
})
