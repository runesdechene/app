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

export async function getLandingImageUrl(): Promise<string | null> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'landing_image_desktop_url')
    .single()

  if (error || !data || !data.value) {
    console.warn('[appSettings] landing_image_desktop_url indisponible:', error?.message)
    return null
  }

  return data.value
}
