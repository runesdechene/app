import { create } from 'zustand'
import { supabase } from '../lib/supabase'

/**
 * Source de vérité unique du barème Gloire/Coupe + cooldowns (mig 067).
 * Chargé une fois au boot via fetchRules(), exposé partout.
 *
 * Toute modification dans le Hub (qui édite app_settings) sera répercutée
 * au prochain boot des clients. Aucun nombre ne doit être hardcodé dans
 * un toast/modale/preview — toujours lire depuis ce store.
 *
 * Les FALLBACKS doivent rester alignés sur les valeurs INSERT de la mig 067
 * pour qu'en cas d'échec réseau l'app affiche encore les bonnes valeurs.
 */

const FALLBACK_RULES = {
  // Gloire (lifetime)
  'glory.discover_remote':  1,
  'glory.visit_gps':        3,
  'glory.plant_flag':       2,
  'glory.add_place':        7,
  'glory.carnet':           3,
  'glory.photo':            1,
  'glory.enigma_very_easy': 1,
  'glory.enigma_easy':      2,
  'glory.enigma_medium':    3,
  'glory.enigma_hard':      5,
  // Coupe (saison)
  'coupe.discover_remote':  0,
  'coupe.visit_gps':        3,
  'coupe.plant_flag':       2,
  'coupe.add_place':        7,
  'coupe.carnet':           3,
  'coupe.photo':            1,
  'coupe.enigma_very_easy': 1,
  'coupe.enigma_easy':      1,
  'coupe.enigma_medium':    1,
  'coupe.enigma_hard':      1,
  // Cooldowns
  'cooldown.replant_hours': 24,
} as const

export type GloryRuleKey = keyof typeof FALLBACK_RULES

interface GloryRulesStore {
  rules: Record<string, number>
  loaded: boolean
  fetchRules: () => Promise<void>
  /** Lecture sécurisée — fallback si la clé n'est pas dans le store */
  get: (key: GloryRuleKey) => number
}

export const useGloryRulesStore = create<GloryRulesStore>((set, getState) => ({
  rules: { ...FALLBACK_RULES },
  loaded: false,
  fetchRules: async () => {
    const { data, error } = await supabase.rpc('get_glory_rules')
    if (error || !data || typeof data !== 'object') {
      console.warn('[gloryRulesStore] fetch failed, using fallbacks', error)
      set({ loaded: true })
      return
    }
    set({
      rules: { ...FALLBACK_RULES, ...(data as Record<string, number>) },
      loaded: true,
    })
  },
  get: (key) => {
    const v = getState().rules[key]
    return typeof v === 'number' ? v : FALLBACK_RULES[key]
  },
}))
