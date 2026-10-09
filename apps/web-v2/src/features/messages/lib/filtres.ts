/**
 * QUOI     — les gélules à cocher du Registre : les deux canaux où l'on écrit, « Activité » qu'on lit
 *            seulement, et chacune de mes Compagnies (migration 422) ; et le choix gardé sur
 *            l'appareil.
 * POURQUOI — Uriel, 05/10 : « certains pourraient vouloir le désactiver » — un canal décoché le
 *            reste à la prochaine ouverture. Le choix garde aussi les canaux connus alors : une
 *            Compagnie rejointe depuis arrive cochée, une Compagnie quittée s'oublie. Un choix
 *            illisible ou vide rend tout coché : le Registre ne s'ouvre jamais vide.
 */
export type Filtre = string
export const FILTRES_FIXES = ['general', 'bugs', 'activite'] as const

const CLE = 'explore-v2:registre:filtres'

type Garde = { coches: string[]; connus: string[] }

function lireGarde(brut: unknown): Garde | null {
  // L'ancien format : la liste des gélules cochées, avant les Compagnies.
  if (Array.isArray(brut)) {
    return { coches: brut.filter((x) => typeof x === 'string'), connus: [...FILTRES_FIXES] }
  }
  if (typeof brut === 'object' && brut !== null && 'coches' in brut && 'connus' in brut) {
    const { coches, connus } = brut
    if (Array.isArray(coches) && Array.isArray(connus)) {
      return {
        coches: coches.filter((x) => typeof x === 'string'),
        connus: connus.filter((x) => typeof x === 'string'),
      }
    }
  }
  return null
}

export function lireFiltres(
  stockage: { getItem: (cle: string) => string | null } | null,
  connus: readonly Filtre[],
) {
  try {
    const garde = lireGarde(JSON.parse(stockage?.getItem(CLE) ?? 'null'))
    if (garde === null) return new Set<Filtre>(connus)
    const coches = connus.filter((f) => garde.coches.includes(f) || !garde.connus.includes(f))
    return new Set<Filtre>(coches.length > 0 ? coches : connus)
  } catch {
    return new Set<Filtre>(connus)
  }
}

export function garderFiltres(
  stockage: { setItem: (cle: string, valeur: string) => void } | null,
  filtres: ReadonlySet<Filtre>,
  connus: readonly Filtre[],
) {
  try {
    stockage?.setItem(CLE, JSON.stringify({ coches: [...filtres], connus: [...connus] }))
  } catch {
    // Stockage plein ou refusé (navigation privée) : le choix vaut pour cette fois.
  }
}
