/**
 * QUOI     — les mises à jour publiées depuis le Hub (migrations 397, 436), les plus récentes
 *            d'abord, avec leur image et leur numéro de version quand elles en ont.
 * POURQUOI — la page « Nouveautés » : la cloche n'en montre que le titre.
 */
import { chaine, liste, nombre, objet, ouNull } from '@/shared/lib/lire'
import { supabase } from '@/shared/supabase/client'

export type MiseAJour = {
  id: number
  titre: string
  texte: string
  quand: string
  image: string | null
  version: string | null // « Pythéas 1.2.4 »
}

export const lireMisesAJour = liste((v): MiseAJour => {
  const m = objet(v)
  return {
    id: nombre(m.id),
    titre: chaine(m.titre),
    texte: chaine(m.texte),
    quand: chaine(m.quand),
    image: ouNull(chaine)(m.image),
    version: ouNull(chaine)(m.version),
  }
})

export async function fetchMisesAJour() {
  const { data, error } = await supabase.rpc('mises_a_jour_publiees')
  if (error) throw error
  return lireMisesAJour(data)
}
