/**
 * QUOI     — la phrase qu'on envoie en partageant un lieu : le texte réglé dans le Hub (app_settings,
 *            share_text_template) où {name} devient le nom du lieu.
 * POURQUOI — un texte vide, absent ou sans {name} ne dirait pas de quel lieu on parle : on garde alors la phrase
 *            d'origine. La lecture qui échoue rend null (le bouton de partage ne doit jamais attendre ni casser).
 */
import { supabase } from '@/shared/supabase/client'

export function phraseDePartage(modele: string | null, nom: string): string {
  if (modele === null || modele.trim() === '' || !modele.includes('{name}')) {
    return `J’ai trouvé ${nom} sur Runes de Chêne EXPLORE - tu connais ?`
  }
  return modele.replaceAll('{name}', nom)
}

export async function lireModeleDePartage(): Promise<string | null> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'share_text_template')
    .maybeSingle()
  return error ? null : (data?.value ?? null)
}
