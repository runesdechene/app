/**
 * QUOI     — les préférences de l'Explorateur connecté : lecture et réglages.
 * POURQUOI — `get_my_preferences` et `set_my_preference` (migration 353) lisent `auth.uid()` :
 *            on ne peut régler que ses propres préférences. Le brouillage garde sa fonction V1.
 * ATTENTION — changer d'e-mail passe par Supabase Auth : un lien de confirmation part vers la
 *            nouvelle adresse, rien ne change avant le clic.
 */
import { supabase } from '@/shared/supabase/client'
import { booleen, chaine, objet, ouNull } from '@/shared/lib/lire'

// « Un fragment qui n'apparaît pas ? » garde le système existant (décision d'Uriel, 27/09) :
// on envoie une photo par le formulaire public du Hub, qui rattache le fragment.
export const SOUMETTRE_PHOTO_URL = 'https://hub.runesdechene.com/soumettre-contenu'

export type Preferences = {
  email: string | null
  brouillerPistes: boolean
  pushImportant: boolean
  pushRecap: boolean
  showDepartement: boolean
  showEnvies: boolean
  lieuxEnCouleur: boolean
  titleGender: 'm' | 'f'
}

export type ClePreference =
  | 'show_departement'
  | 'show_envies'
  | 'push_important_enabled'
  | 'push_recap_enabled'
  | 'lieux_en_couleur'

export async function mesPreferences(): Promise<Preferences> {
  const { data, error } = await supabase.rpc('get_my_preferences')
  if (error) throw error
  const p = objet(data)
  return {
    email: ouNull(chaine)(p.email),
    brouillerPistes: booleen(p.brouillerPistes),
    pushImportant: booleen(p.pushImportant),
    pushRecap: booleen(p.pushRecap),
    showDepartement: booleen(p.showDepartement),
    showEnvies: booleen(p.showEnvies),
    lieuxEnCouleur: booleen(p.lieuxEnCouleur),
    titleGender: p.titleGender === 'f' ? 'f' : 'm',
  }
}

export async function reglerPreference(cle: ClePreference, valeur: boolean) {
  const { error } = await supabase.rpc('set_my_preference', { p_cle: cle, p_valeur: valeur })
  if (error) throw error
}

export async function reglerBrouillage(valeur: boolean) {
  const { error } = await supabase.rpc('set_brouiller_pistes', { p_enabled: valeur })
  if (error) throw error
}

// Le lien de confirmation ramène à la V1 : c'est elle qui recopie la nouvelle adresse dans
// `users.email_address` à la confirmation (événement USER_UPDATED).
export async function changerEmail(email: string) {
  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: `${window.location.origin}/` },
  )
  if (error) throw error
}
