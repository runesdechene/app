import { create } from 'zustand'
import type { GpsMark } from '../types/gpsMark'
import { fetchMyGpsMarks } from '../lib/gpsMarksApi'

interface GpsMarksState {
  marks: GpsMark[]
  loaded: boolean
  refresh: () => Promise<void>
  addLocal: (mark: GpsMark) => void
  removeLocal: (id: string) => void
}

export const useGpsMarksStore = create<GpsMarksState>((set) => ({
  marks: [],
  loaded: false,
  refresh: async () => {
    const marks = await fetchMyGpsMarks()
    set({ marks, loaded: true })
  },
  addLocal: (mark) => set((s) => ({ marks: [mark, ...s.marks] })),
  removeLocal: (id) => set((s) => ({ marks: s.marks.filter((m) => m.id !== id) })),
}))
