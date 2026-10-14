import { couleurValide } from './couleur'

test('un code #RRGGBB', () => {
  expect(couleurValide('#a94842')).toBe(true)
  expect(couleurValide('#A94842')).toBe(true)
})
test('le reste est refusé', () => {
  for (const c of ['a94842', '#a948', '#a94842ff', 'rouge', '']) expect(couleurValide(c)).toBe(false)
})
