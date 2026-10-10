/**
 * QUOI     — la règle du bip : à quel point le viseur ressemble à chaque Fragment, et quand biper.
 * POURQUOI — l'essai du 09/10 : une ressemblance seule bipe à tort ; il faut qu'un Fragment dépasse
 *            le seuil, devance nettement le deuxième, et tienne quelques images d'affilée. Les trois
 *            réglages se fixent au test de l'atelier (spec 2026-10-09-v2-scan, « Valider »).
 * ATTENTION — fonctions pures : le temps arrive en paramètre (`maintenant`, en ms).
 */
export type Reference = { fragment: number; vecteur: ArrayLike<number> }
export type Place = { fragment: number; ressemblance: number }
export type EtatBip = { fragment: number | null; suite: number; silenceJusqua: number }

export const SEUIL = 0.45
// Un seul Fragment a des empreintes (les premières vues, avant le Hub) : pas de deuxième pour juger
// l'avance, alors on exige plus. Réglé avec les trois autres au test de l'atelier.
export const SEUIL_SEUL = 0.6
export const AVANCE = 0.05
export const SUITE = 3
export const SILENCE_MS = 2500

export const DEPART: EtatBip = { fragment: null, suite: 0, silenceJusqua: 0 }

export function ressemblance(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let produit = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    produit += x * y
    na += x * x
    nb += y * y
  }
  return na === 0 || nb === 0 ? 0 : produit / Math.sqrt(na * nb)
}

export function classer(empreinte: ArrayLike<number>, references: Reference[]): Place[] {
  const meilleures = new Map<number, number>()
  for (const r of references) {
    const s = ressemblance(empreinte, r.vecteur)
    if (s > (meilleures.get(r.fragment) ?? -Infinity)) meilleures.set(r.fragment, s)
  }
  return [...meilleures]
    .map(([fragment, s]) => ({ fragment, ressemblance: s }))
    .sort((a, b) => b.ressemblance - a.ressemblance)
}

export function avancer(
  etat: EtatBip,
  classement: Place[],
  maintenant: number,
): { etat: EtatBip; bip: number | null } {
  const [premier, second] = classement
  const net =
    premier !== undefined &&
    (second === undefined
      ? premier.ressemblance >= SEUIL_SEUL
      : premier.ressemblance >= SEUIL && premier.ressemblance - second.ressemblance >= AVANCE)
  if (!net) return { etat: { ...etat, fragment: null, suite: 0 }, bip: null }
  const suite = etat.fragment === premier.fragment ? etat.suite + 1 : 1
  if (suite >= SUITE && maintenant >= etat.silenceJusqua) {
    return {
      etat: { fragment: null, suite: 0, silenceJusqua: maintenant + SILENCE_MS },
      bip: premier.fragment,
    }
  }
  return { etat: { ...etat, fragment: premier.fragment, suite }, bip: null }
}

export function arrondir(vecteur: ArrayLike<number>): number[] {
  return Array.from(vecteur, (x) => Math.round(x * 1e4) / 1e4)
}
