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

export type TypeDeChemin = 'visite' | 'ajout' | 'arrivee'
export type Chemin = {
  id: string // la ligne, telle que la base la connaît pour les saluts
  type: TypeDeChemin
  quand: string
  qui: { id: string; nom: string; avatar: string | null }
  lieu: { id: string; nom: string; region: string | null } | null
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

// Une couleur réglée dans le Hub part dans un style : seul un hex passe, sinon la couleur par défaut.
function hex(v: unknown, parDefaut: string): string {
  return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : parDefaut
}

export function lireBanniere(json: unknown): Banniere | null {
  if (json === null) return null
  const b = objet(json)
  return {
    image: chaine(b.imageUrl),
    titre: chaine(b.title).trim(),
    sousTitre: ouNull(chaine)(b.subtitle)?.trim() || null,
    lien: chaine(b.linkUrl),
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
      return { id: chaine(lieu.id), nom: chaine(lieu.nom), region: ouNull(chaine)(lieu.region) }
    })(c.lieu),
    moi: booleen(c.moi),
    saluts: nombre(c.saluts),
    salue: booleen(c.salue),
  }
}

export const lireChemins = liste(lireChemin)

export function lireSalut(json: unknown) {
  const s = objet(json)
  return { saluts: nombre(s.saluts), salue: booleen(s.salue) }
}
