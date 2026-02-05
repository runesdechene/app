import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types/database.types'

export type { Database } from './types/database.types'
export * from './types/database.types'

let supabaseInstance: SupabaseClient<Database> | null = null

export function createSupabaseClient(url: string, anonKey: string): SupabaseClient<Database> {
  if (supabaseInstance) return supabaseInstance
  
  supabaseInstance = createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  })
  
  return supabaseInstance
}

export function getSupabase(): SupabaseClient<Database> {
  if (!supabaseInstance) {
    throw new Error('Supabase client not initialized. Call createSupabaseClient first.')
  }
  return supabaseInstance
}

export async function signInWithMagicLink(email: string, redirectTo?: string) {
  const supabase = getSupabase()
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo }
  })
}

export async function signOut() {
  const supabase = getSupabase()
  return supabase.auth.signOut()
}

export async function getSession() {
  const supabase = getSupabase()
  return supabase.auth.getSession()
}

export async function getUser() {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
