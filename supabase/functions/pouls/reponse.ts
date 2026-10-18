// Les fonctions pures de l'edge function `pouls` : valider ce qui entre, mettre en forme ce qui sort.
// Tout ce qui se teste vit ici ; index.ts ne fait que brancher la requête, la base et la réponse.

import { timingSafeEqual } from 'https://deno.land/std@0.224.0/crypto/timing_safe_equal.ts'

export type Periode = 'jour' | 'semaine' | 'mois' | 'toujours'
export type Pouls = { nouveaux: number; reactives: number; actifs: number; lieux: number; visites: number; enigmes: number }
export type Avant = Omit<Pouls, 'actifs'>

const PERIODES: readonly string[] = ['jour', 'semaine', 'mois', 'toujours']

export function periodeValide(x: unknown): x is Periode {
  return typeof x === 'string' && PERIODES.includes(x)
}

// Comparaison sur toute la longueur, sans s'arrêter à la première différence.
export function secretValide(entrant: string | null, attendu: string): boolean {
  if (!entrant || !attendu) return false
  const encodeur = new TextEncoder()
  const a = encodeur.encode(entrant)
  const b = encodeur.encode(attendu)
  return a.length === b.length && timingSafeEqual(a, b)
}

function objet(x: unknown, nom: string): Record<string, unknown> {
  if (typeof x !== 'object' || x === null) throw new Error(`${nom} absent`)
  return x as Record<string, unknown>
}

// On ne fabrique jamais un zéro : une clé manquante ou non numérique lève.
function nombre(source: Record<string, unknown>, cle: string): number {
  const valeur = source[cle]
  if (typeof valeur !== 'number') throw new Error(`${cle} n'est pas un nombre`)
  return valeur
}

function lirePouls(brut: unknown): Pouls {
  const s = objet(brut, 'pouls')
  return {
    nouveaux: nombre(s, 'nouveaux'),
    reactives: nombre(s, 'reactives'),
    actifs: nombre(s, 'actifs'),
    lieux: nombre(s, 'lieux'),
    visites: nombre(s, 'visites'),
    enigmes: nombre(s, 'enigmes'),
  }
}

function lireAvant(brut: unknown): Avant | null {
  if (brut === null) return null
  const s = objet(brut, 'avant')
  return {
    nouveaux: nombre(s, 'nouveaux'),
    reactives: nombre(s, 'reactives'),
    lieux: nombre(s, 'lieux'),
    visites: nombre(s, 'visites'),
    enigmes: nombre(s, 'enigmes'),
  }
}

export function miseEnForme(periode: Periode, brut: unknown, lu_a: string) {
  const s = objet(brut, 'jsonb')
  return { periode, pouls: lirePouls(s.pouls), avant: lireAvant(s.avant), lu_a }
}
