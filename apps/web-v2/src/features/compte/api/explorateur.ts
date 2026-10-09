/**
 * QUOI     — charge le profil public d'un Explorateur.
 * POURQUOI — une seule lecture (`get_profil_explorateur`, migration 354) : la base renvoie déjà
 *            ce qu'on a le droit de montrer, listes dédoublonnées, envies masquées ou non.
 */
import { supabase } from '@/shared/supabase/client'
import { lireProfil, type ExplorateurProfile } from './lireProfil'

export async function fetchExplorateur(id: string): Promise<ExplorateurProfile | null> {
  const { data, error } = await supabase.rpc('get_profil_explorateur', { p_user_id: id })
  if (error) throw error
  return lireProfil(data)
}
