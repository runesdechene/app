/**
 * QUOI     — ce que la porte demande à Supabase : la session, le droit d'entrer, le code e-mail.
 * POURQUOI — pas de mot de passe, comme la V2 : un code à 6 chiffres. Le Hub ne crée jamais de
 *            compte (shouldCreateUser: false).
 */
import { supabase } from '@/shared/supabase/client'

export async function lireEntree(): Promise<{ session: boolean; admin: boolean }> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  if (!data.session) return { session: false, admin: false }
  const reponse = await supabase.rpc('hub_est_admin')
  if (reponse.error) throw reponse.error
  return { session: true, admin: reponse.data }
}

export async function envoyerCode(email: string) {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
  if (error) throw error
}

export async function verifierCode(email: string, code: string) {
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
  if (error) throw error
}

export async function sortir() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
