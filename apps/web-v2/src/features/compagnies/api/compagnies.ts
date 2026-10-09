/**
 * QUOI     — les Compagnies et Supabase (migrations 421 et 422) : lire la liste et une fiche,
 *            rejoindre (ou demander), quitter, fonder, gérer (fiche, rôles, demandes, membres), et
 *            envoyer un avatar.
 * POURQUOI — chaque geste passe par une fonction de la base, qui lit `auth.uid()` et refuse ce qui
 *            n'est pas permis (avec un indice : `porteur`, `nom_pris`, `role`…).
 */
import { chaine, objet } from '@/shared/lib/lire'
import { supabase } from '@/shared/supabase/client'
import { preparerPhoto } from '@/shared/lib/photo'
import { envoyerPhotos } from '@/shared/supabase/photos'
import { lireFicheCompagnie, lireListe, type ChampsFiche, type Roles } from './lireCompagnies'

export async function fetchCompagnies() {
  const { data, error } = await supabase.rpc('compagnies')
  if (error) throw error
  return lireListe(data)
}

export async function fetchCompagnie(id: string) {
  const { data, error } = await supabase.rpc('compagnie', { p_id: id })
  if (error) throw error
  return lireFicheCompagnie(data)
}

export async function quitter(id: string) {
  const { error } = await supabase.rpc('quitter_compagnie', { p_id: id })
  if (error) throw error
}

// Publique : on en devient membre ; privée : la demande part aux officiers.
export async function rejoindre(id: string, mot?: string): Promise<'membre' | 'demande'> {
  const { data, error } = await supabase.rpc('rejoindre_compagnie', {
    p_id: id,
    ...(mot !== undefined && mot.trim() !== '' && { p_mot: mot }),
  })
  if (error) throw error
  return chaine(objet(data).etat) === 'membre' ? 'membre' : 'demande'
}

export async function fonder(f: ChampsFiche): Promise<string> {
  const { data, error } = await supabase.rpc('fonder_compagnie', {
    p_nom: f.nom,
    p_devise: f.devise,
    p_mission: f.mission,
    p_couleur: f.couleur,
    p_privee: f.privee,
    ...(f.avatar !== null && { p_avatar: f.avatar }),
  })
  if (error) throw error
  return chaine(objet(data).id)
}

// La fiche et, pour le Chef seulement, les noms des rôles (la base refuse les autres).
export async function modifier(id: string, f: ChampsFiche & Partial<Roles>) {
  const { error } = await supabase.rpc('modifier_compagnie', {
    p_id: id,
    p_nom: f.nom,
    p_devise: f.devise,
    p_mission: f.mission,
    p_couleur: f.couleur,
    p_privee: f.privee,
    ...(f.avatar !== null && { p_avatar: f.avatar }),
    ...(f.chefM !== undefined && { p_chef_m: f.chefM }),
    ...(f.chefF !== undefined && { p_chef_f: f.chefF }),
    ...(f.officierM !== undefined && { p_officier_m: f.officierM }),
    ...(f.officierF !== undefined && { p_officier_f: f.officierF }),
  })
  if (error) throw error
}

export async function repondre(id: string, user: string, oui: boolean) {
  const { error } = await supabase.rpc('repondre_demande', { p_id: id, p_user: user, p_oui: oui })
  if (error) throw error
}

// 'officier' ou 'membre' : nommer ou retirer un officier ; 'chef' : passer la main.
export async function changerRole(id: string, user: string, role: 'chef' | 'officier' | 'membre') {
  const { error } = await supabase.rpc('changer_role', { p_id: id, p_user: user, p_role: role })
  if (error) throw error
}

export async function retirer(id: string, user: string) {
  const { error } = await supabase.rpc('retirer_membre', { p_id: id, p_user: user })
  if (error) throw error
}

// L'avatar part dans mon dossier, comme une photo de lieu ; son adresse rejoint la fiche.
export async function envoyerAvatar(fichier: File): Promise<string> {
  const photo = await preparerPhoto(fichier)
  const [image] = await envoyerPhotos([{ id: crypto.randomUUID(), ...photo }])
  if (!image) throw new Error('avatar non envoyé')
  return image.url
}
