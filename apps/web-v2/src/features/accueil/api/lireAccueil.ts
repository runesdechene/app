/**
 * QUOI     — la forme des blocs de l'Accueil : la bannière de la boutique (celles du Hub, tirées
 *            au hasard par `get_random_home_banner`), puis, depuis le JSON de la migration 368, les
 *            lieux ajoutés récemment et le fil « Sur les chemins ».
 * POURQUOI — rien n'est supposé : chaque champ est prouvé. Les lieux prennent la forme des
 *            cartes de lieu partagées (`LieuDeCarte`).
 */
import { booleen, chaine, liste, nombre, objet, ouNull } from '@/shared/lib/lire'
import type { LieuDeCarte } from '@/shared/ui/LieuCarte'

export type Banniere = {
  image: string
  titre: string
  sousTitre: string | null
  lien: string
  voile: { couleur: string; opacite: number }
  couleurs: { tag: string; titre: string; sousTitre: string }
  ombre: { couleur: string; force: number }
}

// Un lieu proche (« Près de toi », mig 376) : sa distance vient de la base, en mètres.
export type LieuProche = {
  id: string
  nom: string
  imageUrl: string | null
  type: { nom: string; icone: string | null; couleur: string | null } | null
  metres: number
}

// Le Panthéon (migs 378 à 380) : les premiers, ma place, les lieux du dixième.
export type TypeDeClassement = 'visites' | 'ajouts'
export type Periode = '30jours' | 'toujours'
export type GrandExplorateur = {
  rang: number
  id: string
  nom: string
  avatar: string | null
  niveau: number
  titre: string | null
  lieux: number
}
export type GrandsExplorateurs = {
  tete: GrandExplorateur[]
  // Ma place : ma fiche, sans rang tant que je ne suis pas classé.
  moi: (Omit<GrandExplorateur, 'rang'> & { rang: number | null }) | null
  dixieme: number | null
}

export type TypeDeChemin = 'visite' | 'ajout' | 'arrivee'
export type Chemin = {
  id: string // la ligne, telle que la base la connaît pour les saluts
  type: TypeDeChemin
  quand: string
  qui: { id: string; nom: string; avatar: string | null }
  lieu: {
    id: string
    nom: string
    region: string | null
    type: { icone: string; couleur: string | null } | null // mig 375
  } | null
  moi: boolean // ma propre ligne : pas de salut possible
  saluts: number
  salue: boolean
}

const TYPES: readonly TypeDeChemin[] = ['visite', 'ajout', 'arrivee']

function typeDeChemin(v: unknown): TypeDeChemin {
  const t = TYPES.find((type) => type === v)
  if (!t) throw new Error('type de chemin inconnu')
  return t
}

// Une couleur qui part dans un style : un hex, rien d'autre.
const HEX = /^#[0-9a-f]{6}$/i

// Le type du lieu d'une ligne (mig 375) : son icône, et sa couleur si c'est bien un hex.
function lireTypeDeLieu(v: unknown): { icone: string; couleur: string | null } | null {
  if (v === null || v === undefined) return null
  const t = objet(v)
  const couleur = ouNull(chaine)(t.couleur)
  return {
    icone: chaine(t.icone),
    couleur: couleur && HEX.test(couleur) ? couleur : null,
  }
}

// Une couleur réglée dans le Hub : un hex, sinon la couleur par défaut.
function hex(v: unknown, parDefaut: string): string {
  return typeof v === 'string' && HEX.test(v) ? v : parDefaut
}

// Le lien part dans un href : seul http(s) passe (un « javascript: » s'exécuterait au clic).
function estHttp(lien: string): boolean {
  return URL.canParse(lien) && ['http:', 'https:'].includes(new URL(lien).protocol)
}

export function lireBanniere(json: unknown): Banniere | null {
  if (json === null) return null
  const b = objet(json)
  const lien = chaine(b.linkUrl)
  if (!estHttp(lien)) return null
  return {
    image: chaine(b.imageUrl),
    titre: chaine(b.title).trim(),
    sousTitre: ouNull(chaine)(b.subtitle)?.trim() || null,
    lien,
    voile: { couleur: hex(b.overlayColor, '#0f0a05'), opacite: Number(b.overlayOpacity ?? 0.85) },
    couleurs: {
      tag: hex(b.tagColor, '#ffffff'),
      titre: hex(b.titleColor, '#ffffff'),
      sousTitre: hex(b.subtitleColor, '#ffffff'),
    },
    ombre: { couleur: hex(b.shadowColor, '#000000'), force: Number(b.shadowStrength ?? 0) },
  }
}

function lireLieuDeCarte(v: unknown): LieuDeCarte {
  const l = objet(v)
  return {
    id: chaine(l.id),
    nom: chaine(l.nom),
    imageUrl: ouNull(chaine)(l.imageUrl),
    latitude: ouNull(nombre)(l.latitude),
    longitude: ouNull(nombre)(l.longitude),
    categorie: ouNull((c) => ({ icone: chaine(objet(c).icone) }))(l.categorie),
    auteur: ouNull((a) => ({
      nom: chaine(objet(a).nom),
      avatarUrl: ouNull(chaine)(objet(a).avatarUrl),
    }))(l.auteur),
  }
}

export const lireAjoutes = liste(lireLieuDeCarte)

function lireChemin(v: unknown): Chemin {
  const c = objet(v)
  const qui = objet(c.qui)
  return {
    id: chaine(c.id),
    type: typeDeChemin(c.type),
    quand: chaine(c.quand),
    qui: { id: chaine(qui.id), nom: chaine(qui.nom), avatar: ouNull(chaine)(qui.avatar) },
    lieu: ouNull((l) => {
      const lieu = objet(l)
      return {
        id: chaine(lieu.id),
        nom: chaine(lieu.nom),
        region: ouNull(chaine)(lieu.region),
        type: lireTypeDeLieu(lieu.type),
      }
    })(c.lieu),
    moi: booleen(c.moi),
    saluts: nombre(c.saluts),
    salue: booleen(c.salue),
  }
}

export const lireChemins = liste(lireChemin)

function lireLieuProche(json: unknown): LieuProche {
  const l = objet(json)
  const type = ouNull((v) => {
    const t = objet(v)
    const couleur = ouNull(chaine)(t.couleur)
    return {
      nom: chaine(t.nom),
      icone: ouNull(chaine)(t.icone),
      couleur: couleur && HEX.test(couleur) ? couleur : null,
    }
  })(l.type)
  return {
    id: chaine(l.id),
    nom: chaine(l.nom),
    imageUrl: ouNull(chaine)(l.imageUrl),
    type,
    metres: nombre(l.metres),
  }
}

export const lirePresDeMoi = liste(lireLieuProche)

function lireGrandExplorateur(json: unknown): GrandExplorateur {
  const g = objet(json)
  return {
    rang: nombre(g.rang),
    id: chaine(g.id),
    nom: chaine(g.nom),
    avatar: ouNull(chaine)(g.avatar),
    niveau: nombre(g.niveau),
    titre: ouNull(chaine)(g.titre),
    lieux: nombre(g.lieux),
  }
}

export function lireGrandsExplorateurs(json: unknown): GrandsExplorateurs {
  const c = objet(json)
  return {
    tete: liste(lireGrandExplorateur)(c.tete),
    moi: ouNull((v) => {
      const m = objet(v)
      return { ...lireGrandExplorateur({ ...m, rang: 0 }), rang: ouNull(nombre)(m.rang) }
    })(c.moi),
    dixieme: ouNull(nombre)(c.dixieme),
  }
}

export function lireSalut(json: unknown) {
  const s = objet(json)
  return { saluts: nombre(s.saluts), salue: booleen(s.salue) }
}
