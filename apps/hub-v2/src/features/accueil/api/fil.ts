/**
 * QUOI     — lit le fil d'activité (fil_du_hub, migs 507-508), page par page.
 * POURQUOI — la page suivante commence avant la dernière ligne reçue (p_avant).
 */
import { supabase } from '@/shared/supabase/client'

export type TypeActivite = 'compte' | 'lieu' | 'visite' | 'enigme' | 'boutique' | 'photo' | 'message' | 'moderation' | 'notification'

export type Activite = {
  type: TypeActivite
  sorte: string
  cle: string
  quand: string
  qui: { id: string; nom: string; avatar: string | null } | null
  lieu: { id: string; nom: string; departement: string | null } | null
  donnees: Record<string, string | number | boolean | null>
}

export const PAGE = 30

// Le générateur type p_avant comme `string` obligatoire : sans repère, pas de borne haute (« l'infini »).
const SANS_LIMITE = 'infinity'

export async function lireFil(types: TypeActivite[], avant: string | null): Promise<Activite[]> {
  const { data, error } = await supabase.rpc('fil_du_hub', { p_types: types, p_avant: avant ?? SANS_LIMITE, p_limite: PAGE })
  if (error) throw error
  return data as Activite[]
}
