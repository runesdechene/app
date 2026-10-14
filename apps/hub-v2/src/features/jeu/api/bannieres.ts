/**
 * QUOI     — lit les bannières de l'Accueil (table home_banners), en crée une à partir d'une image, en modifie,
 *            change leur image, les supprime (avec leur fichier du bucket home-banners).
 * POURQUOI — écriture directe : la politique « admin manage » de home_banners et les règles du bucket sont
 *            réservées aux admins. Une bannière neuve naît inactive : vide, elle ne doit pas apparaître chez les
 *            joueurs. La ligne est supprimée avant le fichier (si la ligne résistait, une bannière active
 *            montrerait une image cassée) ; l'ancien fichier n'est retiré qu'une fois la ligne à jour.
 */
import { envoyerFichier, retirerFichier } from '@/shared/lib/envoi'
import { supabase } from '@/shared/supabase/client'
import type { Database } from '@/shared/supabase/database.types'

export type Banniere = Database['public']['Tables']['home_banners']['Row']
export type BanniereAEcrire = Omit<Banniere, 'id' | 'created_at' | 'image_url'>

const BUCKET = 'home-banners'
const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

// Même nom de fichier que l'ancien Hub : banner-{date}.{extension}.
const cheminDe = (fichier: File) => `banner-${String(Date.now())}.${EXTENSIONS[fichier.type] ?? 'jpg'}`

export async function lireBannieres(): Promise<Banniere[]> {
  const { data, error } = await supabase.from('home_banners').select('*').order('id')
  if (error) throw new Error(error.message)
  return data
}

export async function creerBanniere(fichier: File): Promise<number> {
  const adresse = await envoyerFichier(BUCKET, cheminDe(fichier), fichier)
  const { data, error } = await supabase
    .from('home_banners').insert({ image_url: adresse, title: '', link_url: '', active: false }).select('id').single()
  if (error) {
    await retirerFichier(BUCKET, adresse).catch(() => undefined)
    throw new Error(error.message)
  }
  return data.id
}

export async function modifierBanniere(id: number, banniere: BanniereAEcrire): Promise<void> {
  const { error } = await supabase.from('home_banners').update(banniere).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function changerImage(banniere: Banniere, fichier: File): Promise<void> {
  const adresse = await envoyerFichier(BUCKET, cheminDe(fichier), fichier)
  const { error } = await supabase.from('home_banners').update({ image_url: adresse }).eq('id', banniere.id)
  if (error) {
    await retirerFichier(BUCKET, adresse).catch(() => undefined)
    throw new Error(error.message)
  }
  await retirerFichier(BUCKET, banniere.image_url).catch(() => undefined)
}

export async function supprimerBanniere(banniere: Banniere): Promise<void> {
  const { error } = await supabase.from('home_banners').delete().eq('id', banniere.id)
  if (error) throw new Error(error.message)
  await retirerFichier(BUCKET, banniere.image_url).catch(() => undefined)
}
