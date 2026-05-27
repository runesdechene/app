import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Configuration Supabase manquante. Verifiez votre fichier .env')
}

const FETCH_TIMEOUT_MS = 30_000

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (url, options = {}) => {
      const controller = new AbortController()
      const timeout = setTimeout(
        () => controller.abort(new DOMException(`Timeout apres ${FETCH_TIMEOUT_MS / 1000}s`, 'TimeoutError')),
        FETCH_TIMEOUT_MS
      )
      // Fusionne le signal eventuel de supabase-js avec NOTRE controller (au lieu de
      // l'ignorer) : timeout + annulation amont coexistent, aucun n'est perdu.
      const upstream = options.signal
      if (upstream) {
        if (upstream.aborted) controller.abort(upstream.reason)
        else upstream.addEventListener('abort', () => controller.abort(upstream.reason), { once: true })
      }
      return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(timeout))
    },
  },
})
