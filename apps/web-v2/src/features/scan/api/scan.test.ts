/**
 * QUOI     — les appels du scan : les vecteurs partent arrondis, avec le modèle ; un scan se note
 *            sans attendre.
 */
import { expect, test, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('@/shared/supabase/client', () => ({ supabase: { rpc } }))

import { ajouterVue, noterScan } from './scan'

test('ajouter une vue envoie le vecteur arrondi et le modèle, et rend l’id', async () => {
  rpc.mockResolvedValueOnce({ data: 42, error: null })
  await expect(ajouterVue(11, [0.123456, 0.5])).resolves.toBe(42)
  expect(rpc).toHaveBeenCalledWith('ajouter_vue', {
    p_fragment: 11,
    p_vecteur: [0.1235, 0.5],
    p_modele: 'mobilenet_v3_small',
  })
})

test('noter un scan part sans qu’on l’attende (requête paresseuse : on appelle then)', () => {
  const then = vi.fn()
  rpc.mockReturnValueOnce({ then })
  noterScan(11)
  expect(rpc).toHaveBeenCalledWith('noter_scan', { p_fragment: 11 })
  expect(then).toHaveBeenCalled()
})
