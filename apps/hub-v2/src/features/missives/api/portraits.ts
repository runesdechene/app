/**
 * QUOI     — ce que le questionnaire « Dis-nous qui tu es » apprend (mig 555), pour « Qui sont-ils ? ».
 */
import type { Question } from '@runes/missives'
import { supabase } from '@/shared/supabase/client'

export type Segment = 'tous' | 'prospects' | 'porteurs'

export type QuiSontIls = {
  repondants: number
  reponses: Partial<Record<Question, { cle: string; nombre: number }[]>>
  /** « Une autre » époque, en clair : la plus citée d'abord (mig 557). */
  epoques_autres: { texte: string; nombre: number }[]
  attentes: { id: string; nom: string | null; texte: string; le: string }[]
  anniversaires_du_mois: { id: string; nom: string | null; jour: number }[]
}

export async function lireQuiSontIls(segment: Segment): Promise<QuiSontIls> {
  const { data, error } = await supabase.rpc('hub_qui_sont_ils', { p_segment: segment })
  if (error) throw error
  return data as QuiSontIls
}
