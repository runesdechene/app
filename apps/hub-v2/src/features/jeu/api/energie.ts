/**
 * QUOI     — lit et écrit les dix réglages de l'Énergie (table app_settings, une ligne par clé).
 * POURQUOI — écriture directe : la politique app_settings_admin_write est réservée aux admins. Un seul upsert
 *            écrit les dix lignes ; les clés absentes de la table sont créées.
 */
import { supabase } from '@/shared/supabase/client'
import { CLES, type LigneDeReglage } from '../lib/energie'

export async function lireReglages(): Promise<LigneDeReglage[]> {
  const { data, error } = await supabase.from('app_settings').select('key, value').in('key', Object.values(CLES))
  if (error) throw new Error(error.message)
  return data
}

export async function ecrireReglages(lignes: LigneDeReglage[]): Promise<void> {
  const { error } = await supabase.from('app_settings').upsert(lignes, { onConflict: 'key' })
  if (error) throw new Error(error.message)
}
