/**
 * QUOI     — changer de photo ne casse jamais l'avatar : la nouvelle est envoyée sous un nom
 *            neuf, enregistrée, et seulement ensuite l'ancienne est supprimée.
 */
import { beforeEach, vi } from 'vitest'

const stockage = vi.hoisted(() => ({
  upload: vi.fn<(chemin: string, ...reste: unknown[]) => Promise<{ error: Error | null }>>(),
  remove: vi.fn(() => Promise.resolve({ error: null })),
  list: vi.fn(() =>
    Promise.resolve({ data: [{ name: 'avatar.webp' }, { name: 'avatar-1.webp' }], error: null }),
  ),
  getPublicUrl: vi.fn((chemin: string) => ({ data: { publicUrl: `https://cdn/${chemin}` } })),
}))
const rpc = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: { success: true }, error: null })))

vi.mock('@/shared/supabase/client', () => ({
  supabase: { storage: { from: () => stockage }, rpc },
}))
vi.mock('./session', () => ({ monIdentifiant: () => Promise.resolve('u1') }))

import { changerAvatar } from './avatar'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('createImageBitmap', () => Promise.resolve({ width: 800, height: 600 }))
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null)
  HTMLCanvasElement.prototype.toBlob = function (rappel: BlobCallback) {
    rappel(new Blob(['x'], { type: 'image/webp' }))
  }
})

const fichier = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })

test('envoi réussi : nom neuf, enregistré, puis les anciennes photos supprimées', async () => {
  stockage.upload.mockResolvedValueOnce({ error: null })
  const url = await changerAvatar(fichier)
  const chemin = stockage.upload.mock.calls[0]?.[0]
  expect(chemin).toMatch(/^u1\/avatar-\d+\.webp$/)
  expect(url).toBe(`https://cdn/${String(chemin)}`)
  expect(rpc).toHaveBeenCalledWith('update_my_profile', { p_user_id: 'u1', p_avatar_url: url })
  expect(stockage.remove).toHaveBeenCalledWith(['u1/avatar.webp', 'u1/avatar-1.webp'])
})

test('envoi raté : rien n’est supprimé ni enregistré, l’ancienne photo reste', async () => {
  stockage.upload.mockResolvedValueOnce({ error: new Error('réseau') })
  await expect(changerAvatar(fichier)).rejects.toThrow()
  expect(stockage.remove).not.toHaveBeenCalled()
  expect(rpc).not.toHaveBeenCalled()
})
