/**
 * QUOI     — ce que le questionnaire « Dis-nous qui tu es » apprend (mig 555) : l'ensemble, pour « Qui sont-ils ? »,
 *            et une personne, pour « Ses missives » sur sa fiche.
 */
import type { Question, Reponses } from '@runes/missives'
import { supabase } from '@/shared/supabase/client'

export type Segment = 'tous' | 'prospects' | 'porteurs'

export type QuiSontIls = {
  repondants: number
  reponses: Partial<Record<Question, { cle: string; nombre: number }[]>>
  attentes: { id: string; nom: string | null; texte: string; le: string }[]
  anniversaires_du_mois: { id: string; nom: string | null; jour: number }[]
}

export type SesMissives = {
  accord: boolean
  accord_le: string | null
  porte: string | null
  listes: string[]
  ambassadeur: 'ambassadeur' | 'egerie' | null
  portrait: (Reponses & { repondu_le: string }) | null
  suite: { cle: string; nom: string; jour_fait: number | null; prochaine_le: string | null; arretee_le: string | null } | null
  derniers_envois: { objet: string; statut: string; le: string }[]
}

export async function lireQuiSontIls(segment: Segment): Promise<QuiSontIls> {
  const { data, error } = await supabase.rpc('hub_qui_sont_ils', { p_segment: segment })
  if (error) throw error
  return data as QuiSontIls
}

export async function lireSesMissives(compte: string): Promise<SesMissives> {
  const { data, error } = await supabase.rpc('hub_ses_missives', { p_user: compte })
  if (error) throw error
  return data as SesMissives
}
