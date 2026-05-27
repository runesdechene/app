import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Configuration Supabase manquante. Verifiez votre fichier .env')
}

// Verrou auth EN MEMOIRE (et non navigator.locks). L'API Web Locks de certains
// navigateurs (Brave) fait avorter l'acquisition du verrou
// ("AbortError: signal is aborted without reason") -> getSession() reste bloque
// -> deconnexion au rechargement + donnees vides, alors que le token est valide.
// Ce verrou serialise les operations auth dans l'onglet sans dependre de navigator.locks.
let authChain: Promise<unknown> = Promise.resolve()
const inMemoryLock = <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
  const run = authChain.then(() => fn())
  authChain = run.then(() => undefined, () => undefined)
  return run
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { lock: inMemoryLock },
})
