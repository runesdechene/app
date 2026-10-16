import { supabase } from './supabase'

// Le texte de partage réglé dans le Hub, ou null : la phrase de repli se décide dans templates/photo.ts.
export async function getShareTextTemplate(): Promise<string | null> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'share_text_template')
    .single()

  if (error || !data) {
    console.warn('[appSettings] Failed to fetch share_text_template, using fallback:', error?.message)
    return null
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
