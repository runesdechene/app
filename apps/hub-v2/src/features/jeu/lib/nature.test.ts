import { slugDe } from './nature'

test('le slug : minuscules, accents ôtés, tout le reste devient un tiret', () => {
  expect(slugDe('Monts & promontoires')).toBe('monts-promontoires')
  expect(slugDe('  Grottes et Cairns  ')).toBe('grottes-et-cairns')
  expect(slugDe('Forêt sacrée d’Éole')).toBe('foret-sacree-d-eole')
})

test('un nom sans lettre ni chiffre donne un slug vide', () => {
  expect(slugDe(' ?! ')).toBe('')
})
