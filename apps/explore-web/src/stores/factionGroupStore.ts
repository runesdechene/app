import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from './playerStore'
import { useMapStore } from './mapStore'

// ─── Types (user-facing « Compagnie » ; mécanique = faction) ──────────────────

export interface MyFaction {
  id: string
  name: string
  color: string
  imageUrl: string | null
  /** Slug du glyphe du set (alternative au PNG). */
  emblemIcon: string | null
  /** Filtre monochrome de l'emblème : 'none' | 'white' | 'black'. */
  emblemMono: string | null
  description: string | null
  isOfficial: boolean
  memberCount: number
  isActive: boolean
  isFounder: boolean
}

export interface FactionSummary {
  id: string
  name: string
  color: string
  imageUrl: string | null
  emblemIcon: string | null
  emblemMono: string | null
  description: string | null
  isOfficial: boolean
  memberCount: number
  /** Score de Coupe de la saison active — classement du scoreboard. */
  score: number
  /** Tags/mots-clés de la Compagnie. */
  tags: string[]
}

export interface FactionMember {
  userId: string
  name: string
  avatarUrl: string | null
  joinedAt: string
  isFounder: boolean
  /** Coupe de la saison active. */
  coupe: number
  /** Couronnes investies (fondation). */
  crownsInvested: number
  /** Couronnes conquises pour la Compagnie (conquête sous bannière / soutien à un membre). */
  crownsConquered?: number
  /** Détail de la Coupe (mérite) par source, clés non-nulles : enigmes/visites/ajouts/veilles/photos. */
  breakdown?: Partial<Record<'enigmes' | 'visites' | 'ajouts' | 'veilles' | 'photos', number>>
}

export interface FactionDetail {
  id: string
  name: string
  color: string
  imageUrl: string | null
  emblemIcon: string | null
  emblemMono: string | null
  /** Slug aléatoire stable pour le lien de partage (découplé de l'id/PK). */
  publicSlug: string | null
  description: string | null
  tags: string[]
  createdBy: string | null
  isOfficial: boolean
  memberCount: number
  /** Coupe cumulée des membres actifs. */
  totalCoupe: number
  /** Couronnes investies cumulées (fondation + conquête) des membres. */
  totalCrowns: number
  members: FactionMember[]
}

// ─── Result types ─────────────────────────────────────────────────────────────

type RpcSuccess<T = Record<string, unknown>> = { success: true } & T
type RpcError = { error: string; cost?: number; balance?: number }
type ActionResult<T = Record<string, unknown>> = RpcSuccess<T> | RpcError

// ─── Sync de la bannière active vers playerStore (couleurs carte / chat) ──────

/** Aligne playerStore + recharge les couleurs de la carte sur la faction active. */
async function syncActiveToPlayer(activeId: string | null, mine: MyFaction[]) {
  const player = usePlayerStore.getState()
  const active = activeId ? mine.find((f) => f.id === activeId) ?? null : null
  player.setUserFactionId(activeId)
  player.setUserFactionColor?.(active?.color ?? null)
  player.setUserFactionTitle?.(active?.name ?? null)
  useMapStore.getState().incrementPlacesRefreshKey?.()
}

// ─── Store ───────────────────────────────────────────────────────────────────

interface FactionGroupState {
  myFactions: MyFaction[]
  activeFactionId: string | null
  directory: FactionSummary[]
  loading: boolean
  factionsLoaded: boolean
  /** Compagnie dont on veut ouvrir le Hall (posée au join). */
  focusFactionId: string | null
  setFocusFaction: (id: string | null) => void

  loadMine: (userId: string) => Promise<void>
  loadDirectory: (search?: string) => Promise<void>
  create: (
    userId: string,
    params: { name: string; color: string; description: string; imageUrl: string | null; tags: string[]; emblemIcon: string | null; emblemMono: string },
  ) => Promise<ActionResult<{ factionId: string; cost: number }>>
  join: (userId: string, factionId: string) => Promise<ActionResult>
  leave: (userId: string, factionId: string) => Promise<ActionResult<{ extinguished: boolean }>>
  switchBanner: (userId: string, factionId: string | null) => Promise<ActionResult<{ activeFactionId: string | null }>>
  updateIdentity: (
    userId: string,
    factionId: string,
    params: { name: string; color: string; description: string; imageUrl: string | null; tags: string[]; emblemIcon: string | null; emblemMono: string },
  ) => Promise<ActionResult>
  removeMember: (userId: string, factionId: string, targetUserId: string) => Promise<ActionResult>
}

export const useFactionGroupStore = create<FactionGroupState>((set) => ({
  myFactions: [],
  activeFactionId: null,
  directory: [],
  loading: false,
  factionsLoaded: false,
  focusFactionId: null,
  setFocusFaction: (id) => set({ focusFactionId: id }),

  loadMine: async (userId) => {
    if (!userId) return
    set({ loading: true })
    const { data, error } = await supabase.rpc('get_my_factions', { p_user_id: userId })
    set({ loading: false, factionsLoaded: true })
    if (error) {
      console.error('[faction] get_my_factions error:', error.message)
      return
    }
    const result = data as { activeFactionId: string | null; factions: MyFaction[] } | null
    if (!result) return
    set({ myFactions: result.factions, activeFactionId: result.activeFactionId })
  },

  loadDirectory: async (search) => {
    set({ loading: true })
    const { data, error } = await supabase.rpc('list_factions', { p_search: search ?? null })
    set({ loading: false })
    if (error) {
      console.error('[faction] list_factions error:', error.message)
      return
    }
    set({ directory: (data as FactionSummary[]) ?? [] })
  },

  create: async (userId, { name, color, description, imageUrl, tags, emblemIcon, emblemMono }) => {
    const { data, error } = await supabase.rpc('create_faction', {
      p_user_id: userId,
      p_name: name,
      p_color: color,
      p_description: description,
      p_image_url: imageUrl,
      p_tags: tags,
      p_emblem_icon: emblemIcon,
      p_emblem_mono: emblemMono,
    })
    if (error) {
      console.error('[faction] create_faction error:', error.message)
      return { error: 'unknown' }
    }
    const result = data as ActionResult<{ factionId: string; cost: number }>
    if ('success' in result && result.success) {
      await useFactionGroupStore.getState().loadMine(userId)
      const s = useFactionGroupStore.getState()
      await syncActiveToPlayer(s.activeFactionId, s.myFactions)
    }
    return result
  },

  join: async (userId, factionId) => {
    const { data, error } = await supabase.rpc('join_faction', {
      p_user_id: userId,
      p_faction_id: factionId,
    })
    if (error) {
      console.error('[faction] join_faction error:', error.message)
      return { error: 'unknown' }
    }
    const result = data as ActionResult
    if ('success' in result && result.success) {
      set((state) => ({
        focusFactionId: factionId,
        directory: state.directory.map((f) =>
          f.id === factionId ? { ...f, memberCount: f.memberCount + 1 } : f
        ),
      }))
      await useFactionGroupStore.getState().loadMine(userId)
      const s = useFactionGroupStore.getState()
      await syncActiveToPlayer(s.activeFactionId, s.myFactions)
    }
    return result
  },

  leave: async (userId, factionId) => {
    const { data, error } = await supabase.rpc('leave_faction', {
      p_user_id: userId,
      p_faction_id: factionId,
    })
    if (error) {
      console.error('[faction] leave_faction error:', error.message)
      return { error: 'unknown' }
    }
    const result = data as ActionResult<{ extinguished: boolean }>
    if ('success' in result && result.success) {
      set((state) => ({
        directory: state.directory.map((f) =>
          f.id === factionId ? { ...f, memberCount: Math.max(0, f.memberCount - 1) } : f
        ),
      }))
      await useFactionGroupStore.getState().loadMine(userId)
      const s = useFactionGroupStore.getState()
      await syncActiveToPlayer(s.activeFactionId, s.myFactions)
    }
    return result
  },

  switchBanner: async (userId, factionId) => {
    const { data, error } = await supabase.rpc('set_active_faction', {
      p_user_id: userId,
      p_faction_id: factionId,
    })
    if (error) {
      console.error('[faction] set_active_faction error:', error.message)
      return { error: 'unknown' }
    }
    const result = data as ActionResult<{ activeFactionId: string | null }>
    if ('success' in result && result.success) {
      set((state) => ({
        activeFactionId: result.activeFactionId,
        myFactions: state.myFactions.map((f) => ({ ...f, isActive: f.id === result.activeFactionId })),
      }))
      const s = useFactionGroupStore.getState()
      await syncActiveToPlayer(result.activeFactionId, s.myFactions)
    }
    return result
  },

  updateIdentity: async (userId, factionId, { name, color, description, imageUrl, tags, emblemIcon, emblemMono }) => {
    const { data, error } = await supabase.rpc('update_faction_identity', {
      p_user_id: userId,
      p_faction_id: factionId,
      p_name: name,
      p_color: color,
      p_description: description,
      p_image_url: imageUrl,
      p_tags: tags,
      p_emblem_icon: emblemIcon,
      p_emblem_mono: emblemMono,
    })
    if (error) {
      console.error('[faction] update_faction_identity error:', error.message)
      return { error: 'unknown' }
    }
    const result = data as ActionResult
    if ('success' in result && result.success) {
      await useFactionGroupStore.getState().loadMine(userId)
      const s = useFactionGroupStore.getState()
      await syncActiveToPlayer(s.activeFactionId, s.myFactions)
    }
    return result
  },

  removeMember: async (userId, factionId, targetUserId) => {
    const { data, error } = await supabase.rpc('remove_faction_member', {
      p_user_id: userId,
      p_faction_id: factionId,
      p_target_user_id: targetUserId,
    })
    if (error) {
      console.error('[faction] remove_faction_member error:', error.message)
      return { error: 'unknown' }
    }
    return data as ActionResult
  },
}))
