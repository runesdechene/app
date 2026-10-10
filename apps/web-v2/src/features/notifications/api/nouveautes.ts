/**
 * QUOI     — les mises à jour publiées depuis le Hub (migrations 397, 436), les plus récentes
 *            d'abord, avec leur image, leur numéro de version, leurs cœurs et leurs mots (478) ; et
 *            sous chacune, son carnet et ses cœurs : les lire, écrire, aimer, effacer.
 * POURQUOI — la page « Nouveautés » : la cloche n'en montre que le titre. Le carnet et les cœurs
 *            d'une note sont ceux d'un lieu (même JSON, même lecture : `shared/lib/carnet`).
 * ATTENTION — une base d'avant la 478 n'a pas les comptes : ils se lisent à zéro.
 */
import { lireCarnet, lireCoeurs } from '@/shared/lib/carnet'
import { booleen, chaine, liste, nombre, objet, ouNull } from '@/shared/lib/lire'
import type { PhotoAEnvoyer } from '@/shared/lib/photo'
import { supabase } from '@/shared/supabase/client'
import { envoyerPhotos } from '@/shared/supabase/photos'

export type MiseAJour = {
  id: number
  titre: string
  texte: string
  quand: string
  image: string | null
  version: string | null // « Pythéas 1.2.4 »
  coeurs: number
  miens: number
  mots: number
  aMoi: boolean // je l'ai publiée : pas de cœur à soi
}

export const lireMisesAJour = liste((v): MiseAJour => {
  const m = objet(v)
  return {
    id: nombre(m.id),
    titre: chaine(m.titre),
    texte: chaine(m.texte),
    quand: chaine(m.quand),
    image: ouNull(chaine)(m.image),
    version: ouNull(chaine)(m.version),
    coeurs: nombre(m.coeurs ?? 0),
    miens: nombre(m.miens ?? 0),
    mots: nombre(m.mots ?? 0),
    aMoi: booleen(m.aMoi ?? false),
  }
})

export async function fetchMisesAJour() {
  const { data, error } = await supabase.rpc('mises_a_jour_publiees')
  if (error) throw error
  return lireMisesAJour(data)
}

export async function fetchCarnetDeMiseAJour(id: number) {
  const { data, error } = await supabase.rpc('carnet_de_mise_a_jour', { p_id: id })
  if (error) throw error
  return lireCarnet(data)
}

// Écrire sous une note : les photos partent d'abord dans mon dossier, puis le mot (comme un lieu).
export async function ecrireSousMiseAJour(
  id: number,
  texte: string,
  photos: PhotoAEnvoyer[],
  parent: number | null,
) {
  const images = photos.length > 0 ? await envoyerPhotos(photos) : []
  const { error } = await supabase.rpc('ecrire_sous_mise_a_jour', {
    p_id: id,
    p_texte: texte,
    p_images: images.map((i) => ({ url: i.url })),
    ...(parent !== null && { p_parent: parent }),
  })
  if (error) throw error
}

export async function basculerCoeurMotDeMiseAJour(mot: number) {
  const { error } = await supabase.rpc('basculer_coeur_mot_mise_a_jour', { p_id: mot })
  if (error) throw error
}

export async function effacerMotDeMiseAJour(mot: number) {
  const { error } = await supabase.rpc('effacer_mot_mise_a_jour', { p_id: mot })
  if (error) throw error
}

export async function fetchCoeursDeMiseAJour(id: number) {
  const { data, error } = await supabase.rpc('coeurs_de_mise_a_jour', { p_id: id })
  if (error) throw error
  return lireCoeurs(data)
}

export async function aimerMiseAJour(id: number) {
  const { error } = await supabase.rpc('aimer_mise_a_jour', { p_id: id })
  if (error) throw error
}
