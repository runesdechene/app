/**
 * QUOI     — la forme d'une fiche de lieu, des Explorateurs, des compagnons et de la récompense
 *            d'une découverte, lues depuis le JSON des fonctions 364-367.
 * POURQUOI — rien n'est supposé : chaque champ est prouvé ; `null` veut dire « introuvable ou
 *            invisible », et l'écran le dit.
 */
import { booleen, chaine, liste, nombre, objet, ouNull } from '@/shared/lib/lire'

export type Personne = { id: string; nom: string; avatar: string | null }
export type Compagnon = Personne & { distance: number }
export type Version = {
  id: number | null
  quand: string
  origine: boolean
  champs: string[]
  note: string | null
  qui: Personne | null
}
export type Mot = {
  id: number
  quand: string
  texte: string
  qui: Personne
  venu: boolean
  photos: string[]
  coeurs: number
  miens: number
  aMoi: boolean
  reponses: Mot[]
}
export type Carnet = { total: number; mots: Mot[] }
export type Coeurs = { total: number; miens: number; gens: (Personne & { nombre: number })[] }
export type FicheLieu = {
  id: string
  slug: string | null // la page publique du lieu (/lieu/<slug>), quand elle existe
  nom: string
  recit: string
  adresse: string | null
  lat: number
  lng: number
  photos: { url: string; vignette: string }[]
  type: { nom: string; icone: string | null; couleur: string | null } | null
  faits: { epoque: string | null; annee: number | null }
  // Les infos en plus (mig 414) : une rubrique vide est null ; le bivouac, une case.
  rubriques: { acces: string | null; quand: string | null; bonASavoir: string | null }
  bivouacTolere: boolean
  explorateurs: { nombre: number; derniers: Personne[] }
  revendication: {
    nom: string
    moi: boolean
    depuis: string
    // « pour Le Lys de Fer » (migration 422).
    pourCompagnie: { id: string; nom: string; couleur: string } | null
  } | null
  auteur: Personne | null
  ajouteLe: string
  // Ajouté sans y être (migration 393) : le crédit de l'auteur est plus discret.
  ajoutADistance: boolean
  // Qui a écrit le récit, par ordre d'arrivée (mig 415) : « Récit partagé de… ».
  recitPar: Personne[]
  moi: { visiteLe: string | null; envie: boolean; decouvert: boolean }
}
// Ce que rapporte une découverte : son rang, l'expérience gagnée, et la jauge du niveau (0 à 1).
export type Recompense = {
  rang: number
  gain: number
  niveau: number
  avant: number
  apres: number
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
  return {
    nom: chaine(r.nom),
    moi: booleen(r.moi),
    depuis: chaine(r.depuis),
    // Absente avant la migration 422 : aucune.
    pourCompagnie: ouNull((v) => {
      const c = objet(v)
      return { id: chaine(c.id), nom: chaine(c.nom), couleur: chaine(c.couleur) }
    })(r.pourCompagnie ?? null),
  }
}

export function lireFiche(json: unknown): FicheLieu | null {
  if (json === null) return null
  const f = objet(json)
  const faits = objet(f.faits)
  const explorateurs = objet(f.explorateurs)
  const moi = objet(f.moi)
  const rubriques = objet(f.rubriques)
  return {
    id: chaine(f.id),
    // Absent tant que la base ne le rend pas (migration 366) : pas de page publique, pas d'erreur.
    slug: typeof f.slug === 'string' ? f.slug : null,
    nom: chaine(f.nom),
    recit: chaine(f.recit),
    adresse: ouNull(chaine)(f.adresse),
    lat: nombre(f.lat),
    lng: nombre(f.lng),
    photos: liste(lirePhoto)(f.photos),
    type: ouNull(lireType)(f.type),
    faits: { epoque: ouNull(chaine)(faits.epoque), annee: ouNull(nombre)(faits.annee) },
    rubriques: {
      acces: ouNull(chaine)(rubriques.acces),
      quand: ouNull(chaine)(rubriques.quand),
      bonASavoir: ouNull(chaine)(rubriques.bonASavoir),
    },
    bivouacTolere: booleen(f.bivouacTolere),
    explorateurs: {
      nombre: nombre(explorateurs.nombre),
      derniers: liste(lirePersonne)(explorateurs.derniers),
    },
    revendication: ouNull(lireRevendication)(f.revendication),
    auteur: ouNull(lirePersonne)(f.auteur),
    ajouteLe: chaine(f.ajouteLe),
    ajoutADistance: booleen(f.ajoutADistance),
    recitPar: liste(lirePersonne)(f.recitPar),
    moi: {
      visiteLe: ouNull(chaine)(moi.visiteLe),
      envie: booleen(moi.envie),
      // Absent tant que la base ne le rend pas (migration 367) : la fiche s'ouvre comme avant.
      decouvert: typeof moi.decouvert === 'boolean' ? moi.decouvert : true,
    },
  }
}

export function lireRecompense(json: unknown): Recompense {
  const r = objet(json)
  return {
    rang: nombre(r.rang),
    gain: nombre(r.gain),
    niveau: nombre(r.niveau),
    avant: nombre(r.avant),
    apres: nombre(r.apres),
  }
}

export function lireExplorateurs(json: unknown) {
  return liste((v) => ({ ...lirePersonne(v), visiteLe: chaine(objet(v).visiteLe) }))(json)
}

export function lireCompagnons(json: unknown): Compagnon[] {
  return liste((v) => ({ ...lirePersonne(v), distance: nombre(objet(v).distance) }))(json)
}

// Les cœurs d'un lieu (mig 384) ; null : le lieu n'est pas visible.
export function lireCoeurs(json: unknown): Coeurs | null {
  if (json === null) return null
  const c = objet(json)
  return {
    total: nombre(c.total),
    miens: nombre(c.miens),
    gens: liste((v) => ({ ...lirePersonne(v), nombre: nombre(objet(v).nombre) }))(c.gens),
  }
}

// L'histoire d'une fiche (mig 387) ; null : le lieu n'est pas visible. La version d'origine
// d'un lieu jamais modifié n'a pas d'identifiant : on n'y revient pas.
export function lireHistoire(json: unknown): Version[] | null {
  if (json === null) return null
  return liste((v): Version => {
    const o = objet(v)
    return {
      id: ouNull(nombre)(o.id),
      quand: chaine(o.quand),
      origine: booleen(o.origine),
      champs: liste(chaine)(o.champs),
      note: ouNull(chaine)(o.note),
      qui: ouNull(lirePersonne)(o.qui),
    }
  })(json)
}

export type ChampEcrit = 'recit' | 'acces' | 'quand' | 'bon_a_savoir'
export type VersionDetail = {
  id: number
  quand: string
  note: string | null
  qui: Personne | null
  champs: { champ: ChampEcrit; avant: string; apres: string }[]
}
const CHAMPS_ECRITS: readonly ChampEcrit[] = ['recit', 'acces', 'quand', 'bon_a_savoir']

function lireChampEcrit(v: unknown): ChampEcrit {
  const champ = CHAMPS_ECRITS.find((c) => c === v)
  if (champ === undefined) throw new Error('champ de version inconnu')
  return champ
}

// Une version et ce qu'elle a changé (mig 415) ; null : introuvable ou invisible.
export function lireVersionDetail(json: unknown): VersionDetail | null {
  if (json === null) return null
  const v = objet(json)
  return {
    id: nombre(v.id),
    quand: chaine(v.quand),
    note: ouNull(chaine)(v.note),
    qui: ouNull(lirePersonne)(v.qui),
    champs: liste((c) => {
      const o = objet(c)
      return { champ: lireChampEcrit(o.champ), avant: chaine(o.avant), apres: chaine(o.apres) }
    })(v.champs),
  }
}

// Le Carnet de passage (mig 389) ; null : le lieu n'est pas visible.
function lireMot(v: unknown): Mot {
  const m = objet(v)
  return {
    id: nombre(m.id),
    quand: chaine(m.quand),
    texte: chaine(m.texte),
    qui: lirePersonne(m.qui),
    venu: booleen(m.venu),
    photos: liste(chaine)(m.photos),
    coeurs: nombre(m.coeurs),
    miens: nombre(m.miens),
    aMoi: booleen(m.aMoi),
    reponses: m.reponses === undefined ? [] : liste(lireMot)(m.reponses),
  }
}

export function lireCarnet(json: unknown): Carnet | null {
  if (json === null) return null
  const c = objet(json)
  return { total: nombre(c.total), mots: liste(lireMot)(c.mots) }
}

// Le prix d'une découverte depuis ma position, et ma jauge (cout_decouverte, migration 399).
// `distanceKm` est null sans position : le prix est alors le plus haut.
export type CoutDecouverte = {
  cout: number
  distanceKm: number | null
  points: number
  max: number
  prochainDans: number | null
  parPoint: number
  gratuitKm: number
}

export function lireCoutDecouverte(json: unknown): CoutDecouverte {
  const c = objet(json)
  return {
    cout: nombre(c.cout),
    distanceKm: ouNull(nombre)(c.distanceKm),
    points: nombre(c.points),
    max: nombre(c.max),
    prochainDans: ouNull(nombre)(c.prochainDans),
    parPoint: nombre(c.parPoint),
    gratuitKm: nombre(c.gratuitKm),
  }
}
