import { supabase } from './supabase'
import { useMapStore } from '../stores/mapStore'
import type { MapVeille } from '../types/veille'

// V0.9.56 — les veilles neutres (expéditions multi-faction) passent en doré.
const NEUTRAL_COLOR = '#D4AF37'

// Cache module-level des couleurs/patterns de faction, peuplé au premier loadInitialVeilles
// puis réutilisé par pushVeilleOverride pour les plants suivants.
const factionColors = new Map<string, string>()
const factionPatterns = new Map<string, string>()
const factionTitles = new Map<string, string>()
let factionsLoaded = false

async function ensureFactionsCache(): Promise<void> {
  if (factionsLoaded) return
  const { data, error } = await supabase.from('factions').select('id, color, pattern, title')
  if (error) {
    console.error('[veilles] factions fetch error:', error.message)
    return
  }
  for (const f of (data ?? []) as Array<{ id: string; color: string | null; pattern: string | null; title: string | null }>) {
    if (f.color) factionColors.set(f.id, f.color)
    if (f.pattern) factionPatterns.set(f.id, f.pattern)
    if (f.title) factionTitles.set(f.id, f.title)
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
    pushVeilleOverride(v.placeId, v.factionId, v.isNeutral, v.members, v.expeditionTitle)
  }
}

/**
 * Push une veille en override sur le mapStore — propage tous les members pour la facepile carte.
 * Accepte n'importe quelle forme avec userId/displayName/avatarUrl (MapVeilleMember ou VeilleMember).
 */
type PushMember = { userId: string; displayName: string; avatarUrl: string | null }
export function pushVeilleOverride(
  placeId: string,
  factionId: string | null,
  isNeutral: boolean,
  members: PushMember[] = [],
  expeditionTitle?: string | null,
): void {
  const lead = members[0]
  const veilleurUserId = lead?.userId || undefined
  const veilleurAvatarUrl = lead?.avatarUrl || undefined
  // V0.9.56 — veille à plusieurs (expédition nommée) : la pilule carte porte le
  // NOM DE L'EXPÉDITION, pas celui du lead. Solo : nom du veilleur (inchangé).
  const isGroup = members.length > 1
  const groupName = expeditionTitle?.trim() || undefined
  const veilleurName = (isGroup && groupName) ? groupName : (lead?.displayName?.trim() || undefined)
  // Le nom d'expédition porte déjà l'idée du groupe → pas de badge "+N" en plus.
  const veilleurExtraCount = (isGroup && groupName) ? 0 : Math.max(0, members.length - 1)
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
  const factionTitle = isNeutral
    ? 'Neutre'
    : (factionId ? factionTitles.get(factionId) : undefined)

  useMapStore.getState().setPlaceOverride(placeId, {
    claimed: true,
    // V0.7 : factionId='__neutral__' pour les expéditions multi-faction (clé de groupe distincte
    // dans le territoryWorker, évite le merge avec les territoires colorés).
    factionId: isNeutral ? '__neutral__' : (factionId ?? undefined),
    tagColor,
    factionTitle,
    factionPattern,
    veilleurUserId,
    veilleurName,
    veilleurAvatarUrl,
    veilleurExtraCount,
    veilleurUserIds: members.map(m => m.userId),
  })
}
