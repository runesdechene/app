/**
 * QUOI     — vérifie que le client refuse de démarrer sans configuration.
 * POURQUOI — une variable d'environnement absente doit casser tout de suite et en clair,
 *            pas produire des requêtes vers « undefined » plus tard.
 */
import { readSupabaseEnv } from './client'

test('refuse une configuration absente', () => {
  expect(() => readSupabaseEnv({})).toThrow('VITE_SUPABASE_URL')
})

test('refuse une clé absente', () => {
  expect(() => readSupabaseEnv({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toThrow(
    'VITE_SUPABASE_ANON_KEY',
  )
})

test('renvoie la configuration complète', () => {
  expect(
    readSupabaseEnv({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' }),
  ).toEqual({ url: 'https://x.supabase.co', anonKey: 'k' })
})
