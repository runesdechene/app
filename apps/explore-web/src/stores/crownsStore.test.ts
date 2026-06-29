import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

const { mockStorageSet, mockStorageGet } = vi.hoisted(() => ({
  mockStorageSet: vi.fn(),
  mockStorageGet: vi.fn(() => '0'),
}))

// Mock safeStorage before importing the store
vi.mock('../lib/safeStorage', () => ({
  safeStorage: { get: mockStorageGet, set: mockStorageSet },
}))

// Mock supabase — not called in demo mode, but needed to avoid import errors
vi.mock('../lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}))

import { useCrownsStore } from './crownsStore'

describe('crownsStore — demo mode guards', () => {
  beforeEach(() => {
    mockStorageSet.mockClear()
    // Reset store to a known non-demo state
    useCrownsStore.setState({ balance: 0, capped: false })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('refresh — forces Infinity+capped:false, does not write safeStorage', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true')
    await useCrownsStore.getState().refresh('user-1')
    const s = useCrownsStore.getState()
    expect(s.balance).toBe(Infinity)
    expect(s.capped).toBe(false)
    expect(mockStorageSet).not.toHaveBeenCalledWith('crownsBalance', expect.anything())
  })

  it('setBalance — forces Infinity+capped:false, does not write safeStorage', () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true')
    useCrownsStore.getState().setBalance(42)
    const s = useCrownsStore.getState()
    expect(s.balance).toBe(Infinity)
    expect(s.capped).toBe(false)
    expect(mockStorageSet).not.toHaveBeenCalled()
  })

  it('harvest — returns HarvestSuccess with balance Infinity, does not write safeStorage', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true')
    const result = await useCrownsStore.getState().harvest('user-1', 'place-abc')
    expect('success' in result && result.success).toBe(true)
    if ('success' in result && result.success) {
      expect(result.balance).toBe(Infinity)
    }
    expect(mockStorageSet).not.toHaveBeenCalledWith('crownsBalance', expect.anything())
    const s = useCrownsStore.getState()
    expect(s.balance).toBe(Infinity)
    expect(s.capped).toBe(false)
  })

  it('setBalance — non-demo path unchanged: writes storage and computes capped', () => {
    vi.stubEnv('VITE_DEMO_MODE', 'false')
    useCrownsStore.getState().setBalance(300)
    const s = useCrownsStore.getState()
    expect(s.balance).toBe(300)
    expect(s.capped).toBe(false)
    expect(mockStorageSet).toHaveBeenCalledWith('crownsBalance', '300')
  })

  it('setBalance — non-demo: balance>=500 sets capped:true', () => {
    vi.stubEnv('VITE_DEMO_MODE', 'false')
    useCrownsStore.getState().setBalance(500)
    expect(useCrownsStore.getState().capped).toBe(true)
  })

  // FIX 5: demo guard on reset()
  it('reset — demo mode sets Infinity, does not write safeStorage', () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true')
    useCrownsStore.setState({ balance: 100, capped: false })
    useCrownsStore.getState().reset()
    const s = useCrownsStore.getState()
    expect(s.balance).toBe(Infinity)
    expect(s.capped).toBe(false)
    expect(mockStorageSet).not.toHaveBeenCalledWith('crownsBalance', expect.anything())
  })

  it('reset — non-demo writes 0 to storage and clears balance', () => {
    vi.stubEnv('VITE_DEMO_MODE', 'false')
    useCrownsStore.setState({ balance: 100 })
    useCrownsStore.getState().reset()
    const s = useCrownsStore.getState()
    expect(s.balance).toBe(0)
    expect(mockStorageSet).toHaveBeenCalledWith('crownsBalance', '0')
  })
})
