import { describe, it, expect } from 'vitest'
import { placeMatchesFilters, type FilterCriteria } from './searchFilterStore'

const base = (over: Partial<{ tagIds: string[]; eraId: string | null; discovered: boolean }> = {}) => ({
  tagIds: ['mega'], eraId: 'iron-age', discovered: false, ...over,
})
const crit = (over: Partial<FilterCriteria> = {}): FilterCriteria => ({
  tagIds: new Set(), eraIds: new Set(), progress: 'all', ...over,
})

describe('placeMatchesFilters', () => {
  it('aucun filtre → tout passe', () => {
    expect(placeMatchesFilters(base(), crit())).toBe(true)
  })
  it('tags = OU (un tag suffit)', () => {
    expect(placeMatchesFilters(base({ tagIds: ['mega'] }), crit({ tagIds: new Set(['mega', 'source']) }))).toBe(true)
    expect(placeMatchesFilters(base({ tagIds: ['ruine'] }), crit({ tagIds: new Set(['mega', 'source']) }))).toBe(false)
  })
  it('époque = OU', () => {
    expect(placeMatchesFilters(base({ eraId: 'iron-age' }), crit({ eraIds: new Set(['iron-age']) }))).toBe(true)
    expect(placeMatchesFilters(base({ eraId: 'renaissance' }), crit({ eraIds: new Set(['iron-age']) }))).toBe(false)
    expect(placeMatchesFilters(base({ eraId: null }), crit({ eraIds: new Set(['iron-age']) }))).toBe(false)
  })
  it('familles = ET', () => {
    const c = crit({ tagIds: new Set(['mega']), eraIds: new Set(['renaissance']) })
    expect(placeMatchesFilters(base({ tagIds: ['mega'], eraId: 'iron-age' }), c)).toBe(false)
  })
  it('progression', () => {
    expect(placeMatchesFilters(base({ discovered: false }), crit({ progress: 'undiscovered' }))).toBe(true)
    expect(placeMatchesFilters(base({ discovered: true }), crit({ progress: 'undiscovered' }))).toBe(false)
    expect(placeMatchesFilters(base({ discovered: true }), crit({ progress: 'discovered' }))).toBe(true)
  })
})
