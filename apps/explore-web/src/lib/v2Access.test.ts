import { describe, it, expect } from 'vitest'
import { wantsV2 } from './v2Access'

describe('wantsV2', () => {
  it('reconnaît ?v=2', () => {
    expect(wantsV2('?v=2')).toBe(true)
    expect(wantsV2('?company=12&v=2')).toBe(true)
  })

  it('ignore tout le reste', () => {
    expect(wantsV2('')).toBe(false)
    expect(wantsV2('?v=1')).toBe(false)
    expect(wantsV2('?version=2')).toBe(false)
  })
})
