/**
 * QUOI     — le changement d'e-mail renvoie le lien de confirmation vers la V1, qui met à jour
 *            l'adresse enregistrée en base à la confirmation.
 */
import { vi } from 'vitest'

const updateUser = vi.hoisted(() => vi.fn(() => Promise.resolve({ error: null })))
vi.mock('@/shared/supabase/client', () => ({ supabase: { auth: { updateUser } } }))

import { changerEmail } from './preferences'

test('le lien de confirmation ramène à la V1', async () => {
  await changerEmail('nouvelle@exemple.fr')
  expect(updateUser).toHaveBeenCalledWith(
    { email: 'nouvelle@exemple.fr' },
    { emailRedirectTo: `${window.location.origin}/` },
  )
})
