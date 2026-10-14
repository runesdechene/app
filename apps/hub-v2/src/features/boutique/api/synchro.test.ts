import { vi } from 'vitest'
import { envoyerEtiquettes } from './synchro'

const mocks = vi.hoisted(() => ({ appelerFonction: vi.fn() }))
vi.mock('@/shared/lib/fonctions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/lib/fonctions')>()), appelerFonction: mocks.appelerFonction,
}))
vi.mock('@/shared/supabase/client', () => ({ supabase: {} }))

test('une réponse sans « results » donne une liste vide, que la pose nomme client par client', async () => {
  mocks.appelerFonction.mockResolvedValue(Response.json({ processed: 0 }))
  await expect(envoyerEtiquettes([{ customerId: 1, email: 'a@b.fr', tags: 'source:app' }])).resolves.toEqual([])
})
