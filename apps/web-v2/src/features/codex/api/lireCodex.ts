/**
 * QUOI     — le Codex d'un Explorateur, lu depuis `mon_codex` (migration 578).
 * POURQUOI — un motif sans collection arrive avec un héritage vide (la synchro écrit '') : il se
 *            range « Hors collection », sans titre à gagner.
 */
import type { EtatFragment } from '@/shared/ui/CarteFragment'
import { booleen, chaine, liste, nombre, objet, ouNull } from '@/shared/lib/lire'
import { lireEdition, type Edition } from '@/shared/lib/edition'

export type FragmentDuCodex = {
  id: number
  nom: string
  illustration: string | null
  etat: EtatFragment
  scans: number
  numero: number | null
  nouveau: boolean
  edition: Edition | null
  editionPrecision: string | null
}

export type Collection = {
  heritage: string | null
  nom: string
  couleur: string | null
  icone: string | null
  titre: string | null
  portes: number
  total: number
  fragments: FragmentDuCodex[]
}

export type Codex = {
  totaux: { portes: number; scannes: number; inconnus: number; total: number }
  collections: Collection[]
}

const ETATS: readonly EtatFragment[] = ['inconnu', 'scanne', 'porte']

function lireEtat(v: unknown): EtatFragment {
  const etat = ETATS.find((e) => e === v)
  if (!etat) throw new Error(`état inconnu : ${String(v)}`)
  return etat
}

const texte = ouNull(chaine)

function lireFragment(v: unknown): FragmentDuCodex {
  const o = objet(v)
  return {
    id: nombre(o.id),
    nom: chaine(o.nom),
    illustration: texte(o.illustration),
    etat: lireEtat(o.etat),
    scans: nombre(o.scans),
    numero: ouNull(nombre)(o.numero),
    nouveau: booleen(o.nouveau),
    edition: lireEdition(o.edition),
    editionPrecision: texte(o.editionPrecision),
  }
}

function lireCollection(v: unknown): Collection {
  const o = objet(v)
  const heritage = texte(o.heritage) || null
  return {
    heritage,
    nom: heritage ?? 'Hors collection',
    couleur: texte(o.couleur),
    icone: texte(o.icone),
    titre: heritage ? texte(o.titre) : null,
    portes: nombre(o.portes),
    total: nombre(o.total),
    fragments: liste(lireFragment)(o.fragments),
  }
}

export function lireCodex(v: unknown): Codex {
  const o = objet(v)
  const t = objet(o.totaux)
  return {
    totaux: {
      portes: nombre(t.portes),
      scannes: nombre(t.scannes),
      inconnus: nombre(t.inconnus),
      total: nombre(t.total),
    },
    collections: liste(lireCollection)(o.collections),
  }
}
