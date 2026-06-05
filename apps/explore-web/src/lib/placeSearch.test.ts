import { describe, it, expect } from 'vitest'
import { normalize, searchPlaces } from './placeSearch'

const items = [
  { id: '1', title: 'Dolmen de Crucuno', address: 'Plouharnel' },
  { id: '2', title: 'Alignements du Ménec', address: 'Carnac' },
  { id: '3', title: 'Source Saint-Gildas', address: 'Carnac' },
]

describe('normalize', () => {
  it('retire accents et casse', () => {
    expect(normalize('Ménec')).toBe('menec')
    expect(normalize('  CRUCUNO ')).toBe('crucuno')
  })
})

describe('searchPlaces', () => {
  it('matche le titre, accent-insensible', () => {
    expect(searchPlaces(items, 'menec').map(i => i.id)).toEqual(['2'])
  })
  it("matche aussi l'adresse", () => {
    expect(searchPlaces(items, 'carnac').map(i => i.id)).toEqual(['2', '3'])
  })
  it('renvoie [] sur requête vide', () => {
    expect(searchPlaces(items, '   ')).toEqual([])
  })
  it('respecte la limite', () => {
    expect(searchPlaces(items, 'a', 1)).toHaveLength(1)
  })
})
