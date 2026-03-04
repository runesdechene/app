import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Configuration Supabase manquante. Verifiez votre fichier .env')
}

const FETCH_TIMEOUT_MS = 15_000

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (url, options = {}) => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      const signal = options.signal ?? controller.signal
      return fetch(url, { ...options, signal })
        .finally(() => clearTimeout(timeout))
    },
  },
})
