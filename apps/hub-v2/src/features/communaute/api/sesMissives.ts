/**
 * QUOI     — « Ses missives » sur la fiche d'un compte (mig 555, hub_ses_missives) : son accord aux nouvelles, ses
 *            listes, sa suite, ses réponses au questionnaire, ses derniers envois ; et le nommer ambassadeur.
 */
import type { Reponses } from '@runes/missives'
import { supabase } from '@/shared/supabase/client'

export type SesMissives = {
  accord: boolean
  accord_le: string | null
  porte: string | null
  listes: string[]
  ambassadeur: 'ambassadeur' | 'egerie' | null
  // repondu_le à null : seul l'anniversaire a été donné (au stand ou dans l'appli), pas le questionnaire.
  portrait: (Reponses & { repondu_le: string | null }) | null
  suite: { cle: string; nom: string; jour_fait: number | null; prochaine_le: string | null; arretee_le: string | null } | null
  derniers_envois: { objet: string; statut: string; le: string }[]
}

export async function lireSesMissives(compte: string): Promise<SesMissives> {
  const { data, error } = await supabase.rpc('hub_ses_missives', { p_user: compte })
  if (error) throw error
  return data as SesMissives
}

export async function nommerAmbassadeur(compte: string): Promise<void> {
  const { error } = await supabase.rpc('hub_ambassadeur', { p_user: compte, p_role: 'ambassadeur' })
  if (error) throw error
}

/** L'anniversaire donné au stand, jour et mois (mig 556) : il ne touche pas aux réponses du questionnaire. */
export async function poserAnniversaire(compte: string, jour: number, mois: number): Promise<void> {
  const { error } = await supabase.rpc('hub_poser_anniversaire', { p_user: compte, p_jour: jour, p_mois: mois })
  if (error) throw error
}
