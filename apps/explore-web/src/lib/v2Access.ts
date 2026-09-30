/**
 * Passerelle V1 → V2. La V2 (apps/web-v2) est servie sous /v2/, ouverte à tous les comptes
 * depuis la mig 398. Le joueur choisit sa version une fois (pop-up « La nouvelle Explore est
 * là ») ; le choix vit dans un cookie `explore_version`, lu aussi par la V2 (« Revenir à
 * l'ancienne Explore » y écrit v1). Code de transition : supprimé avec la V1.
 */
import { supabase } from './supabase'

export type Version = 'v1' | 'v2'

const COOKIE = 'explore_version'
const JOUR = 24 * 60 * 60

export async function hasV2Access(): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_v2_access')
  return !error && data === true
}

export function wantsV2(search: string): boolean {
  return new URLSearchParams(search).get('v') === '2'
}

export function versionChoisie(cookies: string = document.cookie): Version | null {
  const valeur = cookies
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1)
  return valeur === 'v1' || valeur === 'v2' ? valeur : null
}

export function retenirVersion(version: Version, jours: number): void {
  document.cookie = `${COOKIE}=${version}; path=/; max-age=${jours * JOUR}; samesite=lax`
}

// Un retour de connexion (lien magique, mot de passe oublié, OAuth) reste sur la V1 : c'est elle
// qui lit le jeton dans l'adresse.
function retourDeConnexion(search: string, hash: string): boolean {
  return /access_token|error_description|type=recovery/.test(hash)
    || /[?&](code|token_hash|type)=/.test(search)
}

export function doitAllerSurV2(
  cookies: string,
  adresse: { search: string; hash: string },
): boolean {
  return versionChoisie(cookies) === 'v2' && !retourDeConnexion(adresse.search, adresse.hash)
}

export function goToV2(): void {
  retenirVersion('v2', 365)
  window.location.assign('/v2/')
}
