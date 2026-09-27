/**
 * QUOI     — qui est connecté, et la déconnexion.
 * POURQUOI — la session est celle de la V1 (même origine, même clé de stockage) : se
 *            déconnecter ici déconnecte aussi la V1. La garde d'accès le voit et renvoie à la V1.
 */
import { supabase } from '@/shared/supabase/client'

export async function monIdentifiant(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session?.user.id ?? null
}

export async function seDeconnecter(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
