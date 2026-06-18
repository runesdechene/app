import { describe, it, expect } from 'vitest'
import { isGpsMarkFresh, gpsMarkAgeDays } from './gpsMarkFreshness'

const now = new Date('2026-06-16T12:00:00Z').getTime()

describe('gpsMarkAgeDays', () => {
  it('0 jour pour une marque posée à l\'instant', () => {
    expect(gpsMarkAgeDays('2026-06-16T12:00:00Z', now)).toBe(0)
  })
  it('arrondi bas : 9 jours et demi → 9', () => {
    expect(gpsMarkAgeDays('2026-06-07T00:00:00Z', now)).toBe(9)
  })
})

describe('isGpsMarkFresh', () => {
  it('fraîche à 29 jours (seuil 30)', () => {
    expect(isGpsMarkFresh('2026-05-18T12:00:00Z', now, 30)).toBe(true)
  })
  it('périmée à 31 jours (seuil 30)', () => {
    expect(isGpsMarkFresh('2026-05-16T11:00:00Z', now, 30)).toBe(false)
  })
  it('seuil par défaut = 30 jours', () => {
    expect(isGpsMarkFresh('2026-04-01T12:00:00Z', now)).toBe(false)
  })
})
