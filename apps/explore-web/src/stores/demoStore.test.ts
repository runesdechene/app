import { describe, it, expect, beforeEach } from 'vitest'
import { useDemoStore } from './demoStore'

describe('demoStore', () => {
  beforeEach(() => { useDemoStore.getState().reset() })

  it('starts fresh: full energy, Glory 0, 0 discovered, infinite Crowns', () => {
    const s = useDemoStore.getState()
    expect(s.energy).toBe(s.maxEnergy)
    expect(s.glory).toBe(0)
    expect(s.discoveredIds.size).toBe(0)
    expect(s.crownsBalance).toBe(Infinity)
  })

  it('addDiscovered adds id without touching energy', () => {
    useDemoStore.getState().addDiscovered('place-1')
    const s = useDemoStore.getState()
    expect(s.discoveredIds.has('place-1')).toBe(true)
    expect(s.energy).toBe(s.maxEnergy)
  })

  it('addGlory accumulates', () => {
    useDemoStore.getState().addGlory(1)
    useDemoStore.getState().addGlory(2)
    expect(useDemoStore.getState().glory).toBe(3)
  })

  it('reset clears discoveries and Glory', () => {
    useDemoStore.getState().addDiscovered('p')
    useDemoStore.getState().addGlory(5)
    useDemoStore.getState().reset()
    const s = useDemoStore.getState()
    expect(s.discoveredIds.size).toBe(0)
    expect(s.glory).toBe(0)
  })
})
