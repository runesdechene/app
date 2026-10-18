// La lecture des six chiffres : un POST à l'Edge Function `pouls`, jamais une exception.
// Tout échec devient l'une des trois raisons du type Lecture ; le panneau n'a qu'à les dire.

import type { EngineInterface } from 'claude-code'

import type { Avant, Lecture, Options, Periode, Pouls } from '../types'

type Objet = Record<string, unknown>

function objet(x: unknown, nom: string): Objet {
  if (typeof x !== 'object' || x === null) throw new Error(`${nom} absent`)
  return x as Objet
}

// On ne fabrique jamais un zéro : une clé manquante ou non numérique lève.
function nombre(source: Objet, cle: string): number {
  const valeur = source[cle]
  if (typeof valeur !== 'number') throw new Error(`${cle} n'est pas un nombre`)
  return valeur
}

// Les cinq chiffres que le pouls et sa période d'avant ont en commun.
function lireCompteurs(brut: unknown, nom: string): Avant {
  const s = objet(brut, nom)
  return {
    nouveaux: nombre(s, 'nouveaux'),
    reactives: nombre(s, 'reactives'),
    lieux: nombre(s, 'lieux'),
    visites: nombre(s, 'visites'),
    enigmes: nombre(s, 'enigmes'),
  }
}

// `actifs` n'existe que pour le présent : il n'a pas d'« avant ».
function lirePouls(brut: unknown): Pouls {
  return { ...lireCompteurs(brut, 'pouls'), actifs: nombre(objet(brut, 'pouls'), 'actifs') }
}

function lireAvant(brut: unknown): Avant | null {
  return brut === null ? null : lireCompteurs(brut, 'avant')
}

// La date voyage en ISO, la Lecture la garde en millisecondes : on convertit ici, à la frontière.
function lireDate(brut: unknown): number {
  const ms = typeof brut === 'string' ? Date.parse(brut) : NaN
  if (Number.isNaN(ms)) throw new Error('lu_a illisible')
  return ms
}

export async function lire(
  $: Pick<EngineInterface, 'http'>,
  options: Options,
  periode: Periode,
): Promise<Lecture> {
  if (!options.secret) return { ok: false, raison: 'secret_absent' }

  try {
    const reponse = await $.http.fetch(options.url, {
      method: 'POST',
      headers: { 'X-Pouls-Secret': options.secret, 'Content-Type': 'application/json' },
      body: JSON.stringify({ periode }),
    })
    if (!reponse.ok) return { ok: false, raison: 'refus' }

    const corps = objet(JSON.parse(reponse.text), 'réponse')
    return {
      ok: true,
      periode,
      pouls: lirePouls(corps.pouls),
      avant: lireAvant(corps.avant),
      lu_a: lireDate(corps.lu_a),
    }
  } catch {
    return { ok: false, raison: 'reseau' }
  }
}
