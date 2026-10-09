/**
 * QUOI     — les regroupements du passeport : par nature (page 1), par territoire (page 2),
 *            par mois (page 3), et les comptes « N départements · N pays ».
 * POURQUOI — la base renvoie une liste plate (migration 431) ; tout le reste se calcule ici, en
 *            pur, pour que les trois pages s'ouvrent sans nouvel appel.
 * ATTENTION — les tampons arrivent du plus récent au plus ancien ; chaque regroupement garde
 *            cet ordre. Une date « AAAA-MM-JJ » se lit en date locale (`enDate`) : `new Date`
 *            sur la chaîne la lirait en UTC et reculerait d'un jour à l'ouest.
 */
import type { Nature, Tampon } from '../api/lirePasseport'

export type Encre = 'pale' | 'moyen' | 'fort'
export type ParNature = { nature: Nature; compte: number; encre: Encre | null }
export type Territoire = { nom: string; tampons: Tampon[] }
export type Mois = { cle: string; tampons: Tampon[] }

export const AILLEURS = 'Ailleurs'

export function encre(compte: number): Encre {
  if (compte >= 10) return 'fort'
  if (compte >= 2) return 'moyen'
  return 'pale'
}

export function parNature(natures: Nature[], tampons: Tampon[]): ParNature[] {
  return natures.map((nature) => {
    const compte = tampons.filter((t) => t.nature === nature.id).length
    return { nature, compte, encre: compte === 0 ? null : encre(compte) }
  })
}

export function territoireDe(t: Tampon): string {
  return t.departement ?? t.pays ?? AILLEURS
}

function grouper(tampons: Tampon[], cle: (t: Tampon) => string): Map<string, Tampon[]> {
  const groupes = new Map<string, Tampon[]>()
  for (const t of tampons) groupes.set(cle(t), [...(groupes.get(cle(t)) ?? []), t])
  return groupes
}

export function parTerritoire(tampons: Tampon[]): Territoire[] {
  return [...grouper(tampons, territoireDe)].map(([nom, liste]) => ({ nom, tampons: liste }))
}

export function parMois(tampons: Tampon[]): Mois[] {
  return [...grouper(tampons, (t) => t.quand.slice(0, 7))].map(([cle, liste]) => ({
    cle,
    tampons: liste,
  }))
}

export function comptes(tampons: Tampon[]): { departements: number; pays: number } {
  const distincts = (valeurs: (string | null)[]) => new Set(valeurs.filter((v) => v !== null)).size
  return {
    departements: distincts(tampons.map((t) => t.departement)),
    pays: distincts(tampons.map((t) => t.pays)),
  }
}

export function enDate(quand: string): Date {
  const [annee = 0, mois = 1, jour = 1] = quand.split('-').map(Number)
  return new Date(annee, mois - 1, jour)
}
