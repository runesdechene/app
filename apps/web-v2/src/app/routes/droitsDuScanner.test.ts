/**
 * QUOI     — ce que le scanner permet d'apprendre : l'admin retire aussi, le Porteur ajoute, les autres rien.
 */
import { expect, test, vi } from 'vitest'

const moi = vi.hoisted(() => ({ fetchMoi: vi.fn<() => Promise<{ id: string; admin: boolean }>>() }))
const scan = vi.hoisted(() => ({ peutApprendreVue: vi.fn<() => Promise<boolean>>() }))
vi.mock('@/features/lieu/api/lieu', () => moi)
vi.mock('@/features/scan/api/scan', () => scan)

import { lireApprendre } from './droitsDuScanner'

test('un admin', async () => {
  moi.fetchMoi.mockResolvedValue({ id: 'a', admin: true })
  expect(await lireApprendre()).toBe('admin')
})

test('un Porteur', async () => {
  moi.fetchMoi.mockResolvedValue({ id: 'p', admin: false })
  scan.peutApprendreVue.mockResolvedValue(true)
  expect(await lireApprendre()).toBe('porteur')
})

test('un compte sans Fragment', async () => {
  moi.fetchMoi.mockResolvedValue({ id: 'j', admin: false })
  scan.peutApprendreVue.mockResolvedValue(false)
  expect(await lireApprendre()).toBe('non')
})
