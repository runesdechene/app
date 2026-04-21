import { supabase } from './supabase'

const FALLBACK_SHARE_TEMPLATE = "Un trésor oublié t'attend sur Runes de Chêne. Viens explorer {name}."

export async function getShareTextTemplate(): Promise<string> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'share_text_template')
    .single()

  if (error || !data) {
    console.warn('[appSettings] Failed to fetch share_text_template, using fallback:', error?.message)
    return FALLBACK_SHARE_TEMPLATE
  }

  return data.value
}
