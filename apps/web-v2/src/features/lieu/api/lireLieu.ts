/**
 * QUOI     — la forme d'une fiche de lieu, des Explorateurs et des compagnons, lues depuis le
 *            JSON des fonctions 364-365.
 * POURQUOI — rien n'est supposé : chaque champ est prouvé ; `null` veut dire « introuvable ou
 *            invisible », et l'écran le dit.
 */
import { booleen, chaine, liste, nombre, objet, ouNull } from '@/shared/lib/lire'

export type Personne = { id: string; nom: string; avatar: string | null }
export type Compagnon = Personne & { distance: number }
export type FicheLieu = {
  id: string
  nom: string
  recit: string
  adresse: string | null
  lat: number
  lng: number
  photos: { url: string; vignette: string }[]
  type: { nom: string; icone: string | null; couleur: string | null } | null
  faits: {
    epoque: string | null
    annee: number | null
    saison: string | null
    acces: string | null
    bivouac: string | null
  }
  explorateurs: { nombre: number; derniers: Personne[] }
  revendication: { nom: string; moi: boolean; depuis: string } | null
  auteur: Personne | null
  ajouteLe: string
  enrichiPar: { id: string; nom: string } | null
  moi: { visiteLe: string | null; envie: boolean }
}

function lirePersonne(v: unknown): Personne {
  const p = objet(v)
  return { id: chaine(p.id), nom: chaine(p.nom), avatar: ouNull(chaine)(p.avatar) }
}

function lirePhoto(v: unknown) {
  const p = objet(v)
  return { url: chaine(p.url), vignette: chaine(p.vignette) }
}

function lireType(v: unknown) {
  const t = objet(v)
  return { nom: chaine(t.nom), icone: ouNull(chaine)(t.icone), couleur: ouNull(chaine)(t.couleur) }
}

function lireRevendication(v: unknown) {
  const r = objet(v)
  return { nom: chaine(r.nom), moi: booleen(r.moi), depuis: chaine(r.depuis) }
}

function lireEnrichi(v: unknown) {
  const e = objet(v)
  return { id: chaine(e.id), nom: chaine(e.nom) }
}

export function lireFiche(json: unknown): FicheLieu | null {
  if (json === null) return null
  const f = objet(json)
  const faits = objet(f.faits)
  const explorateurs = objet(f.explorateurs)
  const moi = objet(f.moi)
  return {
    id: chaine(f.id),
    nom: chaine(f.nom),
    recit: chaine(f.recit),
    adresse: ouNull(chaine)(f.adresse),
    lat: nombre(f.lat),
    lng: nombre(f.lng),
    photos: liste(lirePhoto)(f.photos),
    type: ouNull(lireType)(f.type),
    faits: {
      epoque: ouNull(chaine)(faits.epoque),
      annee: ouNull(nombre)(faits.annee),
      saison: ouNull(chaine)(faits.saison),
      acces: ouNull(chaine)(faits.acces),
      bivouac: ouNull(chaine)(faits.bivouac),
    },
    explorateurs: {
      nombre: nombre(explorateurs.nombre),
      derniers: liste(lirePersonne)(explorateurs.derniers),
    },
    revendication: ouNull(lireRevendication)(f.revendication),
    auteur: ouNull(lirePersonne)(f.auteur),
    ajouteLe: chaine(f.ajouteLe),
    enrichiPar: ouNull(lireEnrichi)(f.enrichiPar),
    moi: { visiteLe: ouNull(chaine)(moi.visiteLe), envie: booleen(moi.envie) },
  }
}

export function lireExplorateurs(json: unknown) {
  return liste((v) => ({ ...lirePersonne(v), visiteLe: chaine(objet(v).visiteLe) }))(json)
}

export function lireCompagnons(json: unknown): Compagnon[] {
  return liste((v) => ({ ...lirePersonne(v), distance: nombre(objet(v).distance) }))(json)
}
