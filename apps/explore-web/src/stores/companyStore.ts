import { create } from 'zustand'
import { supabase } from '../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MyCompany {
  id: string
  name: string
  color: string
  imageUrl: string | null
  description: string | null
  isOfficial: boolean
  memberCount: number
  isActive: boolean
  isFounder: boolean
}

export interface CompanySummary {
  id: string
  name: string
  color: string
  imageUrl: string | null
  description: string | null
  isOfficial: boolean
  memberCount: number
}

export interface CompanyMember {
  userId: string
  name: string
  joinedAt: string
  isFounder: boolean
}

export interface CompanyDetail {
  id: string
  name: string
  color: string
  imageUrl: string | null
  description: string | null
  founderUserId: string
  isOfficial: boolean
  memberCount: number
  members: CompanyMember[]
}

// ─── Pure selector (testé unitairement) ──────────────────────────────────────

/**
 * Retourne le nombre de secondes restantes avant la fin du cooldown de
 * changement de bannière, ou 0 si le cooldown est écoulé / pas de switchedAt.
 */
export function bannerCooldownRemaining(
  switchedAt: string | null,
  cooldownHours: number,
  now: number,
): number {
  if (!switchedAt) return 0
  const next = new Date(switchedAt).getTime() + cooldownHours * 3600_000
  return Math.max(0, Math.ceil((next - now) / 1000))
}

// ─── Result types ────────────────────────────────────────────────────────────

type RpcSuccess<T = Record<string, unknown>> = { success: true } & T
type RpcError = { error: string; cost?: number; balance?: number; secondsRemaining?: number }
type ActionResult<T = Record<string, unknown>> = RpcSuccess<T> | RpcError

// ─── Store ───────────────────────────────────────────────────────────────────

interface CompanyStoreState {
  myCompanies: MyCompany[]
  activeCompanyId: string | null
  directory: CompanySummary[]
  loading: boolean

  /** Charge les compagnies de l'utilisateur courant */
  loadMine: (userId: string) => Promise<void>
  /** Charge la liste publique (annuaire) */
  loadDirectory: (search?: string) => Promise<void>
  /** Crée une compagnie */
  create: (
    userId: string,
    params: { name: string; color: string; description: string; imageUrl: string | null },
  ) => Promise<ActionResult<{ companyId: string; cost: number }>>
  /** Rejoint une compagnie */
  join: (userId: string, companyId: string) => Promise<ActionResult>
  /** Quitte une compagnie */
  leave: (userId: string, companyId: string) => Promise<ActionResult<{ extinguished: boolean }>>
  /** Change la bannière active (null = bannière perso) */
  switchBanner: (userId: string, companyId: string | null) => Promise<ActionResult<{ activeCompanyId: string | null }>>
  /** Met à jour le nom/couleur/description/emblème d'une compagnie */
  updateIdentity: (
    userId: string,
    companyId: string,
    params: { name: string; color: string; description: string; imageUrl: string | null },
  ) => Promise<ActionResult>
  /** Expulse un membre (fondateur uniquement) */
  removeMember: (userId: string, companyId: string, targetUserId: string) => Promise<ActionResult>
}

export const useCompanyStore = create<CompanyStoreState>((set) => ({
  myCompanies: [],
  activeCompanyId: null,
  directory: [],
  loading: false,

  loadMine: async (userId) => {
    if (!userId) return
    set({ loading: true })
    const { data, error } = await supabase.rpc('get_my_companies', { p_user_id: userId })
    set({ loading: false })
    if (error) {
      console.error('[company] get_my_companies error:', error.message)
      return
    }
    const result = data as { activeCompanyId: string | null; companies: MyCompany[] } | null
    if (!result) return
    set({
      myCompanies: result.companies,
      activeCompanyId: result.activeCompanyId,
    })
  },

  loadDirectory: async (search) => {
    set({ loading: true })
    const { data, error } = await supabase.rpc('list_companies', {
      p_search: search ?? null,
    })
    set({ loading: false })
    if (error) {
      console.error('[company] list_companies error:', error.message)
      return
    }
    set({ directory: (data as CompanySummary[]) ?? [] })
  },

  create: async (userId, { name, color, description, imageUrl }) => {
    const { data, error } = await supabase.rpc('create_company', {
      p_user_id: userId,
      p_name: name,
      p_color: color,
      p_description: description,
      p_image_url: imageUrl,
    })
    if (error) {
      console.error('[company] create_company error:', error.message)
      return { error: 'unknown' }
    }
    const result = data as ActionResult<{ companyId: string; cost: number }>
    if ('success' in result && result.success) {
      await useCompanyStore.getState().loadMine(userId)
    }
    return result
  },

  join: async (userId, companyId) => {
    const { data, error } = await supabase.rpc('join_company', {
      p_user_id: userId,
      p_company_id: companyId,
    })
    if (error) {
      console.error('[company] join_company error:', error.message)
      return { error: 'unknown' }
    }
    const result = data as ActionResult
    if ('success' in result && result.success) {
      await useCompanyStore.getState().loadMine(userId)
    }
    return result
  },

  leave: async (userId, companyId) => {
    const { data, error } = await supabase.rpc('leave_company', {
      p_user_id: userId,
      p_company_id: companyId,
    })
    if (error) {
      console.error('[company] leave_company error:', error.message)
      return { error: 'unknown' }
    }
    const result = data as ActionResult<{ extinguished: boolean }>
    if ('success' in result && result.success) {
      await useCompanyStore.getState().loadMine(userId)
    }
    return result
  },

  switchBanner: async (userId, companyId) => {
    const { data, error } = await supabase.rpc('set_active_banner', {
      p_user_id: userId,
      p_company_id: companyId,
    })
    if (error) {
      console.error('[company] set_active_banner error:', error.message)
      return { error: 'unknown' }
    }
    const result = data as ActionResult<{ activeCompanyId: string | null }>
    if ('success' in result && result.success) {
      // I1 : resync les flags isActive pour que le badge de bannière (menus) suive
      set((state) => ({
        activeCompanyId: result.activeCompanyId,
        myCompanies: state.myCompanies.map((c) => ({ ...c, isActive: c.id === result.activeCompanyId })),
      }))
    }
    return result
  },

  updateIdentity: async (userId, companyId, { name, color, description, imageUrl }) => {
    const { data, error } = await supabase.rpc('update_company_identity', {
      p_user_id: userId,
      p_company_id: companyId,
      p_name: name,
      p_color: color,
      p_description: description,
      p_image_url: imageUrl,
    })
    if (error) {
      console.error('[company] update_company_identity error:', error.message)
      return { error: 'unknown' }
    }
    const result = data as ActionResult
    if ('success' in result && result.success) {
      await useCompanyStore.getState().loadMine(userId)
    }
    return result
  },

  removeMember: async (userId, companyId, targetUserId) => {
    const { data, error } = await supabase.rpc('remove_company_member', {
      p_user_id: userId,
      p_company_id: companyId,
      p_target_user_id: targetUserId,
    })
    if (error) {
      console.error('[company] remove_company_member error:', error.message)
      return { error: 'unknown' }
    }
    const result = data as ActionResult
    if ('success' in result && result.success) {
      await useCompanyStore.getState().loadMine(userId)
    }
    return result
  },
}))
