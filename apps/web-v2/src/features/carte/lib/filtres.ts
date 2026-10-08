/**
 * QUOI     — les filtres de la carte (maquette « Carte — Filtrer », Uriel 30/09) : ma progression,
 *            les natures, les époques. Un lieu passe s'il répond à chacun ; dans les natures et les
 *            époques, l'une ou l'autre suffit.
 *            Les Fragments ont leur interrupteur : montrés par défaut (décision du 08/10).
 * POURQUOI — des fonctions pures : la carte filtre les lieux déjà chargés, sans requête, et tout
 *            se teste sans carte. Un lieu sans époque compte comme « Indéfinie ».
 */
import type { LieuCarte } from '../api/lireCarte'

export type Progression = 'tout' | 'aDecouvrir' | 'visites' | 'ajoutes'

export type Filtres = {
  progression: Progression
  natures: ReadonlySet<string>
  epoques: ReadonlySet<string>
  fragments: boolean
}

export const FILTRES_VIDES: Filtres = {
  progression: 'tout',
  natures: new Set(),
  epoques: new Set(),
  fragments: true,
}

const INDEFINIE = 'unknown'

function suitLaProgression(l: LieuCarte, p: Progression) {
  if (p === 'aDecouvrir') return l.etat === 'inconnu'
  if (p === 'visites') return l.etat === 'visite'
  if (p === 'ajoutes') return l.ajoute
  return true
}

export function filtrer(lieux: LieuCarte[], f: Filtres): LieuCarte[] {
  return lieux.filter(
    (l) =>
      suitLaProgression(l, f.progression) &&
      (f.natures.size === 0 || l.natures.some((n) => f.natures.has(n))) &&
      (f.epoques.size === 0 || f.epoques.has(l.epoque ?? INDEFINIE)),
  )
}

export function filtresActifs(f: Filtres): boolean {
  return f.progression !== 'tout' || f.natures.size > 0 || f.epoques.size > 0 || !f.fragments
}

// Combien de lieux porte chaque nature (principale ou non) : le chiffre à côté de son nom.
export function compterNatures(lieux: LieuCarte[]): Map<string, number> {
  const compte = new Map<string, number>()
  for (const l of lieux) for (const n of l.natures) compte.set(n, (compte.get(n) ?? 0) + 1)
  return compte
}
