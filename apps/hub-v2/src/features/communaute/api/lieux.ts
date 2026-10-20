/**
 * QUOI      — les lieux à modérer : la liste (hub_lieux, mig 517), la fiche (mod_get_place) et les
 *             décisions de l'équipe (mod_update_place, mod_set_place_tags, mod_set_verified, mod_set_masked,
 *             mod_retirer_photo — mig 534).
 * ATTENTION — les mod_* répondent en JSON {error} au lieu de lever : chaque écriture relève cette erreur.
 */
import { supabase } from '@/shared/supabase/client'

export type Filtre = 'a_moderer' | 'verifies' | 'masques' | 'tous'
export type Criteres = { filtre: Filtre; recherche: string; nature: string | null; limite: number; decalage: number }
export type Nature = { id: string; title: string; color: string; background: string }
export type NatureDuLieu = Nature & { is_primary: boolean }
export type LigneDeLieu = {
  id: string; title: string; address: string | null; masked: boolean; sensible: boolean; created_at: string
  verified_at: string | null; author_name: string | null; verified_by_name: string | null
  photo_count: number; thumb_url: string | null; visit_count: number; tags: NatureDuLieu[]
}
export type ListeDeLieux = { total: number; rows: LigneDeLieu[] }
export type FicheDeLieu = Omit<LigneDeLieu, 'tags'> & {
  text: string | null; latitude: number | null; longitude: number | null
  author_id: string | null; author_places_count: number; discovered_count: number
  images: { id: string; url: string; thumb: string | null }[]
  /** Ses natures, la principale d'abord (lues dans place_tags : mod_get_place ne les renvoie pas). */
  tags: { id: string; is_primary: boolean }[]
}
export type Champs = { titre: string; texte: string; sensible: boolean }

const MESSAGES: Record<string, string> = { not_staff: 'Réservé à l’équipe', place_not_found: 'Lieu introuvable',
  no_tags: 'Choisis au moins une nature.', invalid_tag: 'Nature inconnue.', too_many_tags: 'Trois natures au plus.', image_not_found: 'Photo déjà retirée.',
}

function relever(reponse: unknown): void {
  if (typeof reponse === 'object' && reponse !== null && 'error' in reponse && typeof reponse.error === 'string') {
    throw new Error(MESSAGES[reponse.error] ?? reponse.error)
  }
}

export async function lireLieux(c: Criteres): Promise<ListeDeLieux> {
  const { data, error } = await supabase.rpc('hub_lieux', {
    p_filtre: c.filtre, p_recherche: c.recherche, p_limite: c.limite, p_decalage: c.decalage,
    ...(c.nature && { p_nature: c.nature }),
  })
  if (error) throw error
  return data as ListeDeLieux
}

export async function lireLieu(id: string): Promise<FicheDeLieu | null> {
  const { data, error } = await supabase.rpc('mod_get_place', { p_place_id: id })
  if (error) throw error
  if (typeof data === 'object' && data !== null && 'error' in data && data.error === 'place_not_found') return null
  relever(data)
  const natures = await supabase.from('place_tags').select('tag_id, is_primary').eq('place_id', id).order('is_primary', { ascending: false })
  if (natures.error) throw natures.error
  return { ...(data as Omit<FicheDeLieu, 'tags'>), tags: natures.data.map((n) => ({ id: n.tag_id, is_primary: n.is_primary })) }
}

export async function lireNatures(): Promise<Nature[]> {
  const { data, error } = await supabase.from('tags').select('id, title, color, background').order('order')
  if (error) throw error
  return data
}

export async function modifierLieu(id: string, c: Champs): Promise<void> {
  const { data, error } = await supabase.rpc('mod_update_place', { p_place_id: id, p_title: c.titre, p_text: c.texte, p_sensible: c.sensible })
  if (error) throw error
  relever(data)
}

export async function changerNatures(id: string, ids: string[]): Promise<void> {
  const { data, error } = await supabase.rpc('mod_set_place_tags', { p_place_id: id, p_tag_ids: ids })
  if (error) throw error
  relever(data)
}

export async function verifierLieu(id: string, oui: boolean): Promise<void> {
  const { data, error } = await supabase.rpc('mod_set_verified', { p_place_id: id, p_verified: oui })
  if (error) throw error
  relever(data)
}

export async function retirerPhoto(id: string, photo: string): Promise<void> {
  const { data, error } = await supabase.rpc('mod_retirer_photo', { p_place_id: id, p_image_id: photo })
  if (error) throw error
  relever(data)
}

export async function masquerLieu(id: string, oui: boolean): Promise<void> {
  const { data, error } = await supabase.rpc('mod_set_masked', { p_place_id: id, p_masked: oui })
  if (error) throw error
  relever(data)
}
