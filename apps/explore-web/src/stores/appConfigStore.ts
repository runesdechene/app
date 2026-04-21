import { create } from 'zustand'
import { supabase } from '../lib/supabase'

// Fallback hardcodé utilisé si le fetch échoue (DB down, offline, etc.)
// Doit rester identique à la valeur par défaut insérée par la migration 092.
const FALLBACK_SHARE_TEMPLATE = "Un trésor oublié t'attend sur Runes de Chêne. Viens explorer {name}."

interface AppConfigStore {
  shareTextTemplate: string
  loaded: boolean
  fetchConfig: () => Promise<void>
}

export const useAppConfigStore = create<AppConfigStore>((set) => ({
  shareTextTemplate: FALLBACK_SHARE_TEMPLATE,
  loaded: false,
  fetchConfig: async () => {
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['share_text_template'])

    if (error || !data) {
      set({ loaded: true })
      return
    }

    const share = data.find(r => r.key === 'share_text_template')?.value
    set({
      shareTextTemplate: share ?? FALLBACK_SHARE_TEMPLATE,
      loaded: true,
    })
  },
}))
