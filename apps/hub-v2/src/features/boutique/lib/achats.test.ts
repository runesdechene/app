import { etiquetteNormale, tagsDuJournal } from './achats'

test('une étiquette tapée comme le webhook la lit', () => {
  expect(etiquetteNormale('  Fragment:Hoplite ')).toBe('fragment:hoplite')
})
test('les étiquettes trouvées d’une commande sans correspondance', () => {
  expect(tagsDuJournal('tags_found:nw_era,scandinave,animal,nw_era|no_unlock_match')).toEqual(['nw_era', 'scandinave', 'animal'])
})
test('un journal de diagnostic ne donne aucune étiquette', () => {
  expect(tagsDuJournal('debug:no_token|pids:123')).toEqual([])
  expect(tagsDuJournal(null)).toEqual([])
})
