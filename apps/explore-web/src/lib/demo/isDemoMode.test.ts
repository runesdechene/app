import { describe, it, expect, vi, afterEach } from 'vitest'
import { isDemoMode } from './isDemoMode'

describe('isDemoMode', () => {
  afterEach(() => { vi.unstubAllEnvs() })

  it('returns true when VITE_DEMO_MODE is "true"', () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true')
    expect(isDemoMode()).toBe(true)
  })

  it('returns false when VITE_DEMO_MODE is absent', () => {
    vi.stubEnv('VITE_DEMO_MODE', '')
    expect(isDemoMode()).toBe(false)
  })

  it('returns false for any non-"true" value', () => {
    vi.stubEnv('VITE_DEMO_MODE', 'false')
    expect(isDemoMode()).toBe(false)
  })
})
