import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Configuration Supabase manquante. Verifiez votre fichier .env')
}

// Client Supabase standard. Pas de wrapper fetch maison : l'ancien override imposait
// un AbortController/timeout global qui pouvait faire pendre la requete de refresh et
// bloquer le verrou auth (getSession ne rendait jamais la main -> deconnexion au reload
// + requetes vides). supabase-js gere lui-meme ses timeouts/refresh de facon robuste.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
