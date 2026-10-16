import { CATEGORY_BY_TYPE, categoryOf } from '@send-push/categories'
import { catalogue, sorteDe, typesConnus, typesQuiPartent } from './catalogue'

test('chaque type que send-push connaît a une description', () => {
  for (const type of Object.keys(CATEGORY_BY_TYPE)) {
    expect(sorteDe(type).quand, type).not.toBe('sorte héritée de la V1, sans description')
  }
})

test('typesQuiPartent n’a aucun type silencieux', () => {
  const partent = typesQuiPartent()
  expect(partent.length).toBeGreaterThan(0)
  for (const type of partent) expect(categoryOf(type)).not.toBe('silent')
})

test('une mise à jour part en important', () => {
  expect(sorteDe('mise_a_jour').categorie).toBe('important')
  expect(typesQuiPartent()).toContain('mise_a_jour')
})

test('le catalogue ajoute les sortes vues en base, sans doublon', () => {
  expect(typesConnus()).toContain('daily_enigma_ready')
  const types = catalogue(['mise_a_jour', 'inconnue_v1']).map((s) => s.type)
  expect(types).toContain('inconnue_v1')
  expect(types.filter((t) => t === 'mise_a_jour')).toHaveLength(1)
})
