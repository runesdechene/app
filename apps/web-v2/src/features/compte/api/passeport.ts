/**
 * QUOI     — charge le passeport d'un Explorateur.
 * POURQUOI — une seule lecture (`get_passeport`, migration 431) : les trois pages du passeport
 *            se calculent ensuite dans le navigateur, sans autre appel.
 */
import { supabase } from '@/shared/supabase/client'
import { lirePasseport, type Passeport } from './lirePasseport'

export async function fetchPasseport(id: string): Promise<Passeport | null> {
  const { data, error } = await supabase.rpc('get_passeport', { p_user_id: id })
  if (error) throw error
  return lirePasseport(data)
}
