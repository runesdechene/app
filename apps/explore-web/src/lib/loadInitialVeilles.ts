import { supabase } from './supabase'
import { useMapStore } from '../stores/mapStore'
import type { MapVeille } from '../types/veille'

const NEUTRAL_COLOR = '#8a6f4a'

// Cache module-level des couleurs/patterns de faction, peuplé au premier loadInitialVeilles
// puis réutilisé par pushVeilleOverride pour les plants suivants.
const factionColors = new Map<string, string>()
const factionPatterns = new Map<string, string>()
let factionsLoaded = false

async function ensureFactionsCache(): Promise<void> {
  if (factionsLoaded) return
  const { data, error } = await supabase.from('factions').select('id, color, image_url')
  if (error) {
    console.error('[veilles] factions fetch error:', error.message)
    return
  }
  for (const f of (data ?? []) as Array<{ id: string; color: string | null; image_url: string | null }>) {
    if (f.color) factionColors.set(f.id, f.color)
    if (f.image_url) factionPatterns.set(f.id, f.image_url)
  }
  factionsLoaded = true
}

/**
 * Au boot de la carte : charge la liste des veilles (1 par lieu veillé)
 * et applique leur couleur/faction comme placeOverride dans le mapStore.
 */
export async function loadInitialVeilles(): Promise<void> {
  await ensureFactionsCache()

  const { data: veillesData, error } = await supabase.rpc('get_map_veilles')
  if (error) {
    console.error('[loadInitialVeilles] get_map_veilles error:', error.message)
    return
  }

  const veilles = (veillesData as MapVeille[] | null) ?? []
  for (const v of veilles) {
    pushVeilleOverride(v.placeId, v.factionId, v.isNeutral)
  }
}

/**
 * Push une veille (résultat de plant_flag) en override sur le mapStore.
 * À appeler après chaque plant_flag réussi pour rafraîchir la carte instantanément.
 */
export function pushVeilleOverride(placeId: string, factionId: string | null, isNeutral: boolean): void {
  // Le cache de factions doit être chargé — on l'amorce best-effort en lazy.
  if (!factionsLoaded) {
    void ensureFactionsCache()
  }
  const tagColor = isNeutral
    ? NEUTRAL_COLOR
    : (factionId ? factionColors.get(factionId) : undefined)
  const factionPattern = isNeutral || !factionId
    ? undefined
    : factionPatterns.get(factionId)

  useMapStore.getState().setPlaceOverride(placeId, {
    claimed: true,
    factionId: isNeutral ? undefined : (factionId ?? undefined),
    tagColor,
    factionPattern,
  })
}
