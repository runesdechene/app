/**
 * QUOI     — enregistre une culture du Hub (enregistrer_culture) ; la lecture est dans shared/cultures.
 * POURQUOI — une culture ne se crée ni ne se supprime ici : on règle celles qui existent. Chaîne vide =
 *            effacer le champ ; la base contrôle les cercles et son message passe tel quel.
 */
import { supabase } from '@/shared/supabase/client'
import type { CultureDuHub } from '@/shared/cultures/api'

export type CultureAEnregistrer = Pick<CultureDuHub, 'id' | 'label' | 'cercles' | 'active' | 'ordre'> & {
  couleur: string; icone: string; complement: string; zone: string; presentation: string
}

export async function enregistrerCulture(c: CultureAEnregistrer): Promise<void> {
  const { error } = await supabase.rpc('enregistrer_culture', {
    p_id: c.id, p_label: c.label, p_couleur: c.couleur, p_icone: c.icone, p_complement: c.complement,
    p_cercles: c.cercles, p_active: c.active, p_ordre: c.ordre, p_zone: c.zone, p_presentation: c.presentation,
  })
  if (error) throw new Error(error.message)
}
