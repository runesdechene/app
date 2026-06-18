import { create } from 'zustand'
import type { GpsMark } from '../types/gpsMark'
import { fetchMyGpsMarks } from '../lib/gpsMarksApi'

interface GpsMarksState {
  marks: GpsMark[]
  refresh: () => Promise<void>
  addLocal: (mark: GpsMark) => void
  removeLocal: (id: string) => void
}

export const useGpsMarksStore = create<GpsMarksState>((set) => ({
  marks: [],
  refresh: async () => {
    const marks = await fetchMyGpsMarks()
    set({ marks })
  },
  addLocal: (mark) => set((s) => ({ marks: [mark, ...s.marks] })),
  removeLocal: (id) => set((s) => ({ marks: s.marks.filter((m) => m.id !== id) })),
}))
