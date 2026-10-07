/**
 * QUOI     — le client Supabase unique de la V2, typé par le schéma réel de la base.
 * POURQUOI — un seul client pour toute l'app ; les types générés font vérifier chaque nom de
 *            table, de colonne et de RPC par le compilateur.
 * ATTENTION — options de `createClient` laissées PAR DÉFAUT : la clé de stockage par défaut
 *            (`sb-<projet>-auth-token`) est celle de la V1 : à la bascule, les joueurs gardent la
 *            session qu'elle avait ouverte. Changer `storageKey` = déconnecter tout le monde.
 */
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export type { Database } from './database.types'

type Env = Partial<Record<'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY', string>>

export function readSupabaseEnv(env: Env): { url: string; anonKey: string } {
  const url = env.VITE_SUPABASE_URL
  const anonKey = env.VITE_SUPABASE_ANON_KEY
  if (!url) throw new Error('VITE_SUPABASE_URL manquant dans le .env racine')
  if (!anonKey) throw new Error('VITE_SUPABASE_ANON_KEY manquant dans le .env racine')
  return { url, anonKey }
}

const { url, anonKey } = readSupabaseEnv(import.meta.env)

export const supabase = createClient<Database>(url, anonKey)
