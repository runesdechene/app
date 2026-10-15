/**
 * QUOI     — lit les natures (table tags) avec leur nombre de lieux (natures_publiques), en crée et en modifie.
 * POURQUOI — écriture directe : les politiques d'écriture de tags sont réservées aux admins. Une nature ne se
 *            supprime pas (elle porte des lieux). Le nombre de lieux ne compte que les lieux publics.
 */
import { supabase } from '@/shared/supabase/client'

export type Nature = {
  id: string; title: string; color: string; background: string; icon: string | null
  order: number; hors_epoque: boolean; lieux: number
}
export type NatureAEcrire = {
  title: string; color: string; background: string; icon: string | null; order: number; hors_epoque: boolean
}

// natures_publiques rend du JSON : on n'en retient que {id, nombre}.
function nombresDeLieux(json: unknown): Map<string, number> {
  const nombres = new Map<string, number>()
  if (!Array.isArray(json)) return nombres
  for (const ligne of json as unknown[]) {
    if (typeof ligne === 'object' && ligne !== null && 'id' in ligne && 'nombre' in ligne
      && typeof ligne.id === 'string' && typeof ligne.nombre === 'number') nombres.set(ligne.id, ligne.nombre)
  }
  return nombres
}

export async function lireNatures(): Promise<Nature[]> {
  const [tags, lieux] = await Promise.all([
    supabase.from('tags').select('id, title, color, background, icon, order, hors_epoque').order('order').order('title'),
    supabase.rpc('natures_publiques'),
  ])
  if (tags.error) throw new Error(tags.error.message)
  if (lieux.error) throw new Error(lieux.error.message)
  const nombres = nombresDeLieux(lieux.data)
  return tags.data.map((t) => ({ ...t, lieux: nombres.get(t.id) ?? 0 }))
}

export async function creerNature(id: string, nature: NatureAEcrire): Promise<void> {
  const { error } = await supabase.from('tags').insert({ id, ...nature })
  if (error) throw new Error(error.message)
}

export async function modifierNature(id: string, nature: NatureAEcrire): Promise<void> {
  const { error } = await supabase.from('tags').update({ ...nature, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
}
