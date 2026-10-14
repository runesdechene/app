/**
 * QUOI     — le client Supabase unique du Hub, typé par le schéma réel de la base.
 * POURQUOI — les types générés font vérifier chaque table, colonne et RPC par le compilateur.
 * ATTENTION — options par défaut : la session est celle de la clé standard du projet.
 */
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
if (!url) throw new Error('VITE_SUPABASE_URL manquant dans le .env racine')
if (!anonKey) throw new Error('VITE_SUPABASE_ANON_KEY manquant dans le .env racine')

export const supabase = createClient<Database>(url, anonKey)
