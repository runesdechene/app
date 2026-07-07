import { createClient } from '@supabase/supabase-js'
import { isDemoMode } from './demo/isDemoMode'
import { wrapSupabaseForDemo } from './demo/demoSupabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Configuration Supabase manquante. Vérifiez votre fichier .env')
}

const realClient = createClient(supabaseUrl, supabaseAnonKey)

export const supabase = isDemoMode() ? wrapSupabaseForDemo(realClient) : realClient
