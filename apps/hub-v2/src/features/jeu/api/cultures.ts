/**
 * QUOI     — lit les cultures du Hub (cultures_du_hub) et en enregistre une (enregistrer_culture).
 * POURQUOI — une culture ne se crée ni ne se supprime ici : on règle celles qui existent. Chaîne vide =
 *            effacer le champ ; la base contrôle les cercles et son message passe tel quel.
 */
import { supabase } from '@/shared/supabase/client'
import type { Cercle } from '../lib/cercle'

export type CultureDuHub = {
  id: string; label: string; couleur: string | null; icone: string | null; complement: string | null
  zone: string | null; presentation: string | null; cercles: Cercle[]; active: boolean; ordre: number
  stock: number; total: number; eveils: { lat: number; lng: number }[]
}
export type CultureAEnregistrer = Pick<CultureDuHub, 'id' | 'label' | 'cercles' | 'active' | 'ordre'> & {
  couleur: string; icone: string; complement: string; zone: string; presentation: string
}

export async function lireCulturesDuHub(): Promise<CultureDuHub[]> {
  const { data, error } = await supabase.rpc('cultures_du_hub')
  if (error) throw new Error(error.message)
  return data as CultureDuHub[]
}

export async function enregistrerCulture(c: CultureAEnregistrer): Promise<void> {
  const { error } = await supabase.rpc('enregistrer_culture', {
    p_id: c.id, p_label: c.label, p_couleur: c.couleur, p_icone: c.icone, p_complement: c.complement,
    p_cercles: c.cercles, p_active: c.active, p_ordre: c.ordre, p_zone: c.zone, p_presentation: c.presentation,
  })
  if (error) throw new Error(error.message)
}
