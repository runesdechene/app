/**
 * QUOI     — la forme d'un lieu sur la carte et du territoire sous son centre, lues depuis le
 *            JSON de `carte_lieux` et `territoire_en` (migration 363).
 * POURQUOI — l'état et la nature se lisent par liste blanche : une valeur que la base ajoutera
 *            demain s'affiche comme « inconnu » ou « lieu », jamais comme une carte vide.
 */
import { booleen, chaine, liste, nombre, objet, ouNull } from '@/shared/lib/lire'

export type EtatLieu = 'inconnu' | 'connu' | 'visite'

export type LieuCarte = {
  id: string
  nom: string
  lat: number
  lng: number
  nature: 'lieu' | 'curiosite'
  icone: string | null
  couleur: string | null
  etat: EtatLieu
  revendication: { nom: string; moi: boolean } | null
  // Pour les filtres (migration 396) : toutes ses natures, son époque, ajouté par moi.
  natures: string[]
  epoque: string | null
  ajoute: boolean
}

// Ce que la feuille des filtres propose (filtres_de_carte, migration 396).
export type NatureFiltre = { id: string; nom: string; icone: string | null; couleur: string | null }
export type FiltresDeCarte = { natures: NatureFiltre[]; epoques: { id: string; nom: string }[] }

export type Territoire = { territoire: string | null; pays: string | null }

// Un Explorateur trouvé par la recherche de la carte (chercher_explorateurs, migration 373).
export type ExplorateurTrouve = { id: string; nom: string; avatar: string | null }

function lireEtat(v: unknown): EtatLieu {
  return v === 'connu' || v === 'visite' ? v : 'inconnu'
}

function lireRevendication(v: unknown) {
  const r = objet(v)
  return { nom: chaine(r.nom), moi: booleen(r.moi) }
}

function lireLieu(v: unknown): LieuCarte {
  const l = objet(v)
  return {
    id: chaine(l.id),
    nom: chaine(l.nom),
    lat: nombre(l.lat),
    lng: nombre(l.lng),
    nature: l.nature === 'curiosite' ? 'curiosite' : 'lieu',
    icone: ouNull(chaine)(l.icone),
    couleur: ouNull(chaine)(l.couleur),
    etat: lireEtat(l.etat),
    revendication: ouNull(lireRevendication)(l.revendication),
    // La carte des visiteurs (392) ne les rend pas : pas de filtre pour elle.
    natures: Array.isArray(l.natures) ? liste(chaine)(l.natures) : [],
    epoque: ouNull(chaine)(l.epoque ?? null),
    ajoute: l.ajoute === true,
  }
}

export function lireFiltres(json: unknown): FiltresDeCarte {
  const f = objet(json)
  return {
    natures: liste((v): NatureFiltre => {
      const n = objet(v)
      return {
        id: chaine(n.id),
        nom: chaine(n.nom),
        icone: ouNull(chaine)(n.icone),
        couleur: ouNull(chaine)(n.couleur),
      }
    })(f.natures),
    epoques: liste((v) => {
      const e = objet(v)
      return { id: chaine(e.id), nom: chaine(e.nom) }
    })(f.epoques),
  }
}

export function lireLieux(json: unknown): LieuCarte[] {
  return liste(lireLieu)(json)
}

export function lireTerritoire(json: unknown): Territoire {
  const t = objet(json)
  return { territoire: ouNull(chaine)(t.territoire), pays: ouNull(chaine)(t.pays) }
}

export const lireExplorateurs = liste((v): ExplorateurTrouve => {
  const e = objet(v)
  return { id: chaine(e.id), nom: chaine(e.nom), avatar: ouNull(chaine)(e.avatar) }
})
