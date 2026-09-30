/**
 * QUOI     — les mises à jour publiées depuis le Hub (migration 397), les plus récentes d'abord.
 * POURQUOI — la page « Nouveautés » : la cloche n'en montre que le titre.
 */
import { chaine, liste, nombre, objet } from '@/shared/lib/lire'
import { supabase } from '@/shared/supabase/client'

export type MiseAJour = { id: number; titre: string; texte: string; quand: string }

export const lireMisesAJour = liste((v): MiseAJour => {
  const m = objet(v)
  return {
    id: nombre(m.id),
    titre: chaine(m.titre),
    texte: chaine(m.texte),
    quand: chaine(m.quand),
  }
})

export async function fetchMisesAJour() {
  const { data, error } = await supabase.rpc('mises_a_jour_publiees')
  if (error) throw error
  return lireMisesAJour(data)
}
