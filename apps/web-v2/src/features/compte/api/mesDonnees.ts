/**
 * QUOI     — tes données : les télécharger (mes_donnees, mig 497) ; supprimer ton compte
 *            (supprimer_mon_compte, mig 496).
 * POURQUOI — le RGPD (art. 15, 17, 20) : accéder à ses données, les emporter, les effacer, depuis
 *            l'appli, sans avoir à écrire à personne.
 * ATTENTION — la photo de profil s'efface d'abord : le stockage ne s'efface pas en SQL, et après
 *            la suppression on n'a plus le droit d'écrire dans son dossier. Puis la session se
 *            ferme sur ce seul appareil (`local`) : le compte de connexion n'existe déjà plus.
 */
import { supabase } from '@/shared/supabase/client'
import { monIdentifiant } from './session'

export async function telechargerMesDonnees(): Promise<unknown> {
  const { data, error } = await supabase.rpc('mes_donnees')
  if (error) throw error
  return data
}

export async function supprimerMonCompte(): Promise<void> {
  const moi = await monIdentifiant()
  if (!moi) throw new Error('Connexion requise')
  const seau = supabase.storage.from('place-images')
  const { data: fichiers } = await seau.list(moi)
  const avatars = (fichiers ?? [])
    .filter((f) => f.name.startsWith('avatar'))
    .map((f) => `${moi}/${f.name}`)
  if (avatars.length > 0) await seau.remove(avatars)
  const { error } = await supabase.rpc('supprimer_mon_compte')
  if (error) throw error
  await supabase.auth.signOut({ scope: 'local' })
}
