import { describe, it, expect } from 'vitest'
import { bannerCooldownRemaining } from './companyStore'

describe('bannerCooldownRemaining', () => {
  it('retourne 0 si switchedAt est null', () => {
    expect(bannerCooldownRemaining(null, 6, Date.now())).toBe(0)
  })

  it('retourne 0 si le cooldown est écoulé', () => {
    // switched il y a 10h, cooldown 6h → déjà passé
    const switchedAt = new Date(Date.now() - 10 * 3600_000).toISOString()
    expect(bannerCooldownRemaining(switchedAt, 6, Date.now())).toBe(0)
  })

  it('retourne les secondes restantes si dans la fenêtre', () => {
    // switched il y a exactement 2h, cooldown 6h → 4h restantes = 14400 s
    const now = new Date('2026-06-24T12:00:00Z').getTime()
    const switchedAt = new Date('2026-06-24T10:00:00Z').toISOString()
    expect(bannerCooldownRemaining(switchedAt, 6, now)).toBe(14400)
  })
})
