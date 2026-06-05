import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export type ProgressFilter = 'all' | 'undiscovered' | 'discovered'

export interface SearchablePlace {
  id: string
  title: string
  address: string
  lng: number
  lat: number
  eraId: string | null
  tagIds: string[]
  discovered: boolean
}

export interface FilterCriteria {
  tagIds: Set<string>
  eraIds: Set<string>
  progress: ProgressFilter
}

export interface TagMeta {
  id: string; title: string; color: string; background: string; icon: string | null; order: number
}
export interface EraMeta { id: string; name: string; sortOrder: number }

/** Prédicat pur (testé) : OU dans une famille, ET entre familles. */
export function placeMatchesFilters(
  p: { tagIds: string[]; eraId: string | null; discovered: boolean },
  f: FilterCriteria,
): boolean {
  if (f.tagIds.size > 0 && !p.tagIds.some(t => f.tagIds.has(t))) return false
  if (f.eraIds.size > 0 && (p.eraId === null || !f.eraIds.has(p.eraId))) return false
  if (f.progress === 'undiscovered' && p.discovered) return false
  if (f.progress === 'discovered' && !p.discovered) return false
  return true
}

interface SearchFilterState {
  // Taxonomies (chips)
  tags: TagMeta[]
  eras: EraMeta[]
  taxonomiesLoaded: boolean
  loadTaxonomies: () => Promise<void>

  // Liste publiée par usePlaces
  places: SearchablePlace[]
  setPlaces: (p: SearchablePlace[]) => void

  // Critères de filtre
  tagIds: Set<string>
  eraIds: Set<string>
  progress: ProgressFilter
  toggleTag: (id: string) => void
  toggleEra: (id: string) => void
  setProgress: (p: ProgressFilter) => void
  resetFilters: () => void

  // UI
  overlayOpen: boolean
  sheetOpen: boolean
  openOverlay: () => void
  closeOverlay: () => void
  openSheet: () => void
  closeSheet: () => void
}

function toggleInSet(set: Set<string>, id: string): Set<string> {
  const next = new Set(set)
  if (next.has(id)) next.delete(id); else next.add(id)
  return next
}

export const useSearchFilterStore = create<SearchFilterState>((set, get) => ({
  tags: [],
  eras: [],
  taxonomiesLoaded: false,
  loadTaxonomies: async () => {
    if (get().taxonomiesLoaded) return
    const [tagsRes, erasRes] = await Promise.all([
      supabase.from('tags').select('id, title, color, background, icon, order').order('order'),
      supabase.from('eras').select('id, name, sort_order').order('sort_order'),
    ])
    set({
      tags: (tagsRes.data ?? []).map(t => ({
        id: t.id, title: t.title, color: t.color, background: t.background, icon: t.icon, order: t.order ?? 0,
      })),
      eras: (erasRes.data ?? [])
        .filter(e => e.id !== 'unknown')
        .map(e => ({ id: e.id, name: e.name, sortOrder: e.sort_order ?? 0 })),
      taxonomiesLoaded: true,
    })
  },

  places: [],
  setPlaces: (p) => set({ places: p }),

  tagIds: new Set(),
  eraIds: new Set(),
  progress: 'all',
  toggleTag: (id) => set(s => ({ tagIds: toggleInSet(s.tagIds, id) })),
  toggleEra: (id) => set(s => ({ eraIds: toggleInSet(s.eraIds, id) })),
  setProgress: (p) => set({ progress: p }),
  resetFilters: () => set({ tagIds: new Set(), eraIds: new Set(), progress: 'all' }),

  overlayOpen: false,
  sheetOpen: false,
  openOverlay: () => set({ overlayOpen: true }),
  closeOverlay: () => set({ overlayOpen: false }),
  openSheet: () => set({ sheetOpen: true }),
  closeSheet: () => set({ sheetOpen: false }),
}))
