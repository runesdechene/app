import { vi } from 'vitest'
import { enregistrerFragment } from './fragments'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('@/shared/supabase/client', () => ({ supabase: { rpc } }))

const base = { id: 7, origine_nom: 'Sparte', visible: true, theme: null }

beforeEach(() => {
  rpc.mockReset()
  rpc.mockResolvedValue({ error: null })
})

test('l’origine posée envoie ses coordonnées', async () => {
  await enregistrerFragment({ ...base, origine_lat: 43.1, origine_lng: 5.9 })
  expect(rpc).toHaveBeenCalledWith('hub_enregistrer_fragment', { p_id: 7, p_visible: true, p_theme: '', p_origine_nom: 'Sparte', p_origine_lat: 43.1, p_origine_lng: 5.9 })
})

test('sans origine, ni latitude ni longitude ne partent', async () => {
  await enregistrerFragment({ ...base, origine_nom: null, origine_lat: null, origine_lng: null })
  expect(rpc).toHaveBeenCalledWith('hub_enregistrer_fragment', { p_id: 7, p_visible: true, p_theme: '', p_origine_nom: '' })
})

test('le refus de la base est relevé', async () => {
  rpc.mockResolvedValue({ error: { message: 'Culture inconnue : zzz' } })
  await expect(enregistrerFragment({ ...base, origine_lat: null, origine_lng: null })).rejects.toThrow('Culture inconnue : zzz')
})
