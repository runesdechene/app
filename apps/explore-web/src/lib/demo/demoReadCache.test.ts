import { describe, it, expect, beforeEach } from 'vitest'
import { getCached, setCached, cacheKey, CACHEABLE_READS } from './demoReadCache'

describe('demoReadCache', () => {
  beforeEach(() => { setCached('__reset__', null, undefined as unknown) })

  it('cacheKey est stable pour les mêmes args', () => {
    expect(cacheKey('get_map_places', { p_type: 'all' }))
      .toBe(cacheKey('get_map_places', { p_type: 'all' }))
  })

  it('setCached puis getCached renvoie la donnée', () => {
    setCached('get_map_places', { p_type: 'all' }, [{ id: 1 }])
    expect(getCached('get_map_places', { p_type: 'all' })).toEqual([{ id: 1 }])
  })

  it('getCached renvoie undefined si absent', () => {
    expect(getCached('get_map_veilles', { x: 9 })).toBeUndefined()
  })

  it('CACHEABLE_READS contient les lectures carte/énigme', () => {
    expect(CACHEABLE_READS.has('get_map_places')).toBe(true)
    expect(CACHEABLE_READS.has('get_map_veilles')).toBe(true)
  })
})
