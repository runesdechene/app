/**
 * QUOI     — les collections du Codex (couleur, icône, titre de qui la porte entière) et le titre du
 *            Porteur d'un Fragment.
 * POURQUOI — l'appli les montre au Codex (spec 2026-11-02-codex-design) ; la boutique ne les montre
 *            pas. Couleur et icône vivent dans codex_collections (migration 577) ; les titres dans
 *            titles, comme tous les titres (migration 580). Tout passe par des fonctions réservées à
 *            l'équipe.
 */
import { supabase } from '@/shared/supabase/client'

export type CollectionDuCodex = { heritage: string; couleur: string | null; icone_url: string | null; titre: string | null }

export async function lireCollections(): Promise<CollectionDuCodex[]> {
  const { data, error } = await supabase.rpc('hub_collections')
  if (error) throw new Error(error.message)
  return data as CollectionDuCodex[]
}

// Un champ vide efface la couleur ou l'icône ; un titre vide laisse le titre tel quel.
export async function ecrireCollection(c: { heritage: string; couleur: string; icone_url: string; titre: string }): Promise<void> {
  const { error } = await supabase.rpc('hub_ecrire_collection', {
    p_heritage: c.heritage, p_couleur: c.couleur, p_icone_url: c.icone_url, p_titre: c.titre,
  })
  if (error) throw new Error(error.message)
}

export async function lireTitreDuFragment(fragment: number): Promise<string | null> {
  const { data, error } = await supabase.rpc('hub_titre_fragment', { p_fragment: fragment })
  if (error) throw new Error(error.message)
  return data
}

export async function ecrireTitreDuFragment(fragment: number, nom: string): Promise<void> {
  const { error } = await supabase.rpc('hub_ecrire_titre_fragment', { p_fragment: fragment, p_nom: nom })
  if (error) throw new Error(error.message)
}
