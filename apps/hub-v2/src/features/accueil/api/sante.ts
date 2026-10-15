/**
 * QUOI     — lit la santé de la boutique : la fonction Netlify shopify-health-check (Shopify répond-il ?)
 *            et la date de la dernière reconstruction des fiches publiques (app_settings.fiches_publiques_le).
 * POURQUOI — le workflow de la nuit écrit cette date après son déploiement (R11) ; sans elle, une nuit
 *            ratée ne se voit nulle part. La lecture d'app_settings est publique pour cette clé.
 */
import { appelerFonction, lireReponse } from '@/shared/lib/fonctions'
import { supabase } from '@/shared/supabase/client'

export type SanteShopify = { latence: number }

// Une boutique qui ne répond pas arrive en `{ ok: false, error }` : lireReponse en fait une erreur.
export async function lireSanteShopify(): Promise<SanteShopify> {
  const reponse = await lireReponse<{ latency_ms: number }>(await appelerFonction('shopify-health-check'))
  return { latence: reponse.latency_ms }
}

export async function lireFichesPubliques(): Promise<string | null> {
  const { data, error } = await supabase
    .from('app_settings').select('value').eq('key', 'fiches_publiques_le').maybeSingle()
  if (error) throw new Error(error.message)
  return data?.value ?? null
}
