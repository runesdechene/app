import { describe, it, expect } from 'vitest'
import { formatRelativeTime } from './dateFormat'

describe('formatRelativeTime', () => {
  const now = new Date('2026-06-05T12:00:00Z').getTime()

  it('renvoie "" pour null/undefined', () => {
    expect(formatRelativeTime(null, now)).toBe('')
    expect(formatRelativeTime(undefined, now)).toBe('')
  })
  it('renvoie "à l\'instant" pour < 60 s', () => {
    expect(formatRelativeTime('2026-06-05T11:59:30Z', now)).toBe("à l'instant")
  })
  it('renvoie les minutes', () => {
    expect(formatRelativeTime('2026-06-05T11:45:00Z', now)).toBe('il y a 15 min')
  })
  it('renvoie les heures (format compact)', () => {
    expect(formatRelativeTime('2026-06-05T09:00:00Z', now)).toBe('il y a 3h')
  })
  it('renvoie les jours (format compact)', () => {
    expect(formatRelativeTime('2026-06-03T12:00:00Z', now)).toBe('il y a 2j')
  })
  it('accepte un objet Date', () => {
    expect(formatRelativeTime(new Date('2026-06-05T11:45:00Z'), now)).toBe('il y a 15 min')
  })
})
