import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUrlDe } from './useUrlDe'

describe('useUrlDe', () => {
  let liberee: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    vi.useFakeTimers()
    liberee = vi.spyOn(URL, 'revokeObjectURL')
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('libère l’adresse une seconde après le dernier écran', () => {
    const photo = new Blob(['a'])
    const { result, unmount } = renderHook(() => useUrlDe(photo))
    const adresse = result.current
    expect(adresse).not.toBeNull()

    unmount()
    expect(liberee).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(liberee).toHaveBeenCalledWith(adresse)
  })

  it('garde l’adresse reprise dans la seconde', () => {
    const photo = new Blob(['b'])
    const premier = renderHook(() => useUrlDe(photo))
    const adresse = premier.result.current
    premier.unmount()

    const second = renderHook(() => useUrlDe(photo))
    vi.advanceTimersByTime(5000)
    expect(second.result.current).toBe(adresse)
    expect(liberee).not.toHaveBeenCalled()
  })
})
