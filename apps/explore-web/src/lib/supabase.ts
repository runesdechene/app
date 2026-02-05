import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Configuration Supabase manquante. Vérifiez votre fichier .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function testConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.getSession()
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Erreur inconnue' }
  }
}

export async function fetchTables(): Promise<string[]> {
  const { error } = await supabase.from('places').select('id').limit(1)
  
  if (error) {
    console.error('Test query failed:', error.message)
    return []
  }
  
  return [
    'image_media', 'member_codes', 'mikro_orm_migrations', 'password_resets',
    'place_types', 'places', 'places_bookmarked', 'places_explored',
    'places_liked', 'places_viewed', 'refresh_tokens', 'reviews',
    'reviews_images', 'users'
  ]
}
