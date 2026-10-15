/**
 * QUOI     — lit les titres (table titles), en crée, en modifie et en supprime.
 * POURQUOI — écriture directe : la politique equipe_ecrit de titles est réservée aux admins. Seuls les titres de
 *            chemin se créent et se suppriment ; pour les autres, seuls les textes et l'icône sont envoyés.
 *            Les titres de Compagnie (type « faction », V1) ne sont ni lus ni montrés : on n'en garde que le compte.
 */
import type { Json } from '@/shared/supabase/database.types'
import { supabase } from '@/shared/supabase/client'

export type Titre = {
  id: number; name: string; name_f: string | null; description: string | null; icon: string | null
  type: string; condition: Json; order: number
}
export type ListeDesTitres = { titres: Titre[]; compagnieV1: number }
export type TitreAEcrire = {
  name: string; name_f: string | null; description: string | null; icon: string | null
  condition?: { stat: string; min: number }
}

const COLONNES = 'id, name, name_f, description, icon, type, condition, order'

export async function lireTitres(): Promise<ListeDesTitres> {
  const { data, error } = await supabase.from('titles').select(COLONNES).order('order')
  if (error) throw new Error(error.message)
  return {
    titres: data.filter((t) => t.type === 'general'),
    compagnieV1: data.filter((t) => t.type === 'faction').length,
  }
}

export async function creerTitre(titre: TitreAEcrire & { condition: { stat: string; min: number } }, ordre: number): Promise<number> {
  const { data, error } = await supabase.from('titles').insert({ ...titre, type: 'general', order: ordre }).select('id').single()
  if (error) throw new Error(error.message)
  return data.id
}

export async function modifierTitre(id: number, titre: TitreAEcrire): Promise<void> {
  const { error } = await supabase.from('titles').update(titre).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function supprimerTitre(id: number): Promise<void> {
  const { error } = await supabase.from('titles').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
