/**
 * QUOI     — les collections du Codex : couleur, icône et titre d'une collection thématique.
 * POURQUOI — l'appli les montre au Codex (spec 2026-11-02-codex-design) ; la boutique ne les montre
 *            pas, elles vivent donc en base (table codex_collections, migration 577), écrites par
 *            hub_ecrire_collection (réservée à l'équipe).
 */
import { supabase } from '@/shared/supabase/client'

export type CollectionDuCodex = { heritage: string; couleur: string | null; icone_url: string | null; titre: string | null }

export async function lireCollections(): Promise<CollectionDuCodex[]> {
  const { data, error } = await supabase.from('codex_collections').select('heritage, couleur, icone_url, titre')
  if (error) throw new Error(error.message)
  return data
}

// Un champ vide efface la valeur (la base le range à null).
export async function ecrireCollection(c: { heritage: string; couleur: string; icone_url: string; titre: string }): Promise<void> {
  const { error } = await supabase.rpc('hub_ecrire_collection', {
    p_heritage: c.heritage, p_couleur: c.couleur, p_icone_url: c.icone_url, p_titre: c.titre,
  })
  if (error) throw new Error(error.message)
}
