/**
 * Passerelle V1 → V2 : ?v=2 dans l'URL, et le droit d'afficher « Essayer la V2 ».
 * La V2 (apps/web-v2, servie sous /v2/) est réservée aux comptes autorisés (mig 344) ;
 * la V1 n'envoie vers /v2/ que ceux-là. Code de transition : supprimé avec la V1.
 */
import { supabase } from './supabase'

export async function hasV2Access(): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_v2_access')
  return !error && data === true
}

export function wantsV2(search: string): boolean {
  return new URLSearchParams(search).get('v') === '2'
}

export function goToV2(): void {
  window.location.assign('/v2/')
}
