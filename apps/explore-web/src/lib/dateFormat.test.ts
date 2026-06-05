import { describe, it, expect } from 'vitest'
import { formatTimeAgo } from './dateFormat'

describe('formatTimeAgo', () => {
  const now = new Date('2026-06-05T12:00:00Z').getTime()
  it('renvoie "à l\'instant" pour < 60 s', () => {
    expect(formatTimeAgo('2026-06-05T11:59:30Z', now)).toBe("à l'instant")
  })
  it('renvoie les minutes', () => {
    expect(formatTimeAgo('2026-06-05T11:45:00Z', now)).toBe('il y a 15 min')
  })
  it('renvoie les heures', () => {
    expect(formatTimeAgo('2026-06-05T09:00:00Z', now)).toBe('il y a 3 h')
  })
  it('renvoie les jours', () => {
    expect(formatTimeAgo('2026-06-03T12:00:00Z', now)).toBe('il y a 2 j')
  })
})
