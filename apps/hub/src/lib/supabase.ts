import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Configuration Supabase manquante. Verifiez votre fichier .env')
}

// Verrou auth EN MEMOIRE (et non navigator.locks) : l'API Web Locks de certains
// navigateurs (Brave) fait avorter l'acquisition sous reseau instable
// ("AbortError: signal is aborted without reason") -> getSession bloque -> deconnexion
// intermittente au reload. Ce verrou serialise sans timeout-abort.
let authChain: Promise<unknown> = Promise.resolve()
const inMemoryLock = <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
  const run = authChain.then(() => fn())
  authChain = run.then(() => undefined, () => undefined)
  return run
}

// Retry reseau : encaisse les blips DNS/connexion (reseau capricieux) en reessayant
// les echecs reseau. NE manipule PAS le signal/abort (contrairement a l'ancien wrapper
// qui cassait tout) et NE reessaie PAS une annulation volontaire.
const NETWORK_RETRIES = 2
const fetchWithRetry: typeof fetch = async (input, init) => {
  let lastErr: unknown
  for (let attempt = 0; attempt <= NETWORK_RETRIES; attempt++) {
    try {
      return await fetch(input, init)
    } catch (e) {
      if (init?.signal?.aborted) throw e
      lastErr = e
      if (attempt < NETWORK_RETRIES) await new Promise(res => setTimeout(res, 400 * (attempt + 1)))
    }
  }
  throw lastErr
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { lock: inMemoryLock },
  global: { fetch: fetchWithRetry },
})
