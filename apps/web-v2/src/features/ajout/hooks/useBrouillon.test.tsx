/**
 * QUOI     — le brouillon se charge, s'enregistre après chaque geste (pas avant qu'on ait
 *            touché à quoi que ce soit), et se jette.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { BROUILLON_VIDE } from '../lib/brouillon'
import { useBrouillon } from './useBrouillon'

const stockage = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(() => Promise.resolve()),
  del: vi.fn(() => Promise.resolve()),
}))
vi.mock('idb-keyval', () => stockage)

beforeEach(() => {
  stockage.get.mockResolvedValue(undefined)
})

test('sans brouillon gardé : un brouillon vide, et rien d’enregistré tant qu’on n’a rien touché', async () => {
  const { result } = renderHook(() => useBrouillon())
  await waitFor(() => {
    expect(result.current.brouillon).toEqual(BROUILLON_VIDE)
  })
  await new Promise((r) => setTimeout(r, 400))
  expect(stockage.set).not.toHaveBeenCalled()
})

test('un geste : le brouillon s’enregistre, et le compteur d’enregistrements avance', async () => {
  const { result } = renderHook(() => useBrouillon())
  await waitFor(() => {
    expect(result.current.brouillon).not.toBeNull()
  })
  act(() => {
    result.current.changer({ nom: 'Château de Colomars' })
  })
  await waitFor(() => {
    expect(stockage.set).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ nom: 'Château de Colomars' }),
    )
  })
  await waitFor(() => {
    expect(result.current.enregistre).toBe(1)
  })
})

test('un brouillon gardé se reprend ; le jeter l’efface', async () => {
  stockage.get.mockResolvedValue({ ...BROUILLON_VIDE, nom: 'Tour', etape: 'recit' })
  const { result } = renderHook(() => useBrouillon())
  await waitFor(() => {
    expect(result.current.brouillon?.nom).toBe('Tour')
  })
  await act(async () => {
    await result.current.jeter()
  })
  expect(stockage.del).toHaveBeenCalled()
  expect(result.current.brouillon).toEqual(BROUILLON_VIDE)
})
