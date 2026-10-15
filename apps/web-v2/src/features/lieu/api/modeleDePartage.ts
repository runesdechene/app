/**
 * QUOI     — le texte de partage réglé dans le Hub (app_settings, share_text_template).
 * POURQUOI — la lecture qui échoue rend null : le bouton de partage ne doit jamais attendre ni casser. La
 *            phrase elle-même se compose dans `lib/phraseDePartage.ts`.
 */
import { supabase } from '@/shared/supabase/client'

export async function lireModeleDePartage(): Promise<string | null> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'share_text_template')
    .maybeSingle()
  return error ? null : (data?.value ?? null)
}
