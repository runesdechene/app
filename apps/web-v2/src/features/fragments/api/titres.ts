/**
 * QUOI     — porter des titres sous son nom (trois au plus) : `set_my_displayed_titles`.
 * POURQUOI — le titre du Porteur d'un Fragment est un titre comme les autres (migration 580) ; la
 *            fiche l'ajoute à ceux déjà portés.
 */
import { supabase } from '@/shared/supabase/client'

export async function porterTitres(ids: number[]): Promise<void> {
  const { error } = await supabase.rpc('set_my_displayed_titles', { p_title_ids: ids })
  if (error) throw error
}
