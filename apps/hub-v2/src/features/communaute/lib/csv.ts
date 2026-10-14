/**
 * QUOI     — la liste des comptes en CSV (séparateur « ; », que le tableur français ouvre sans question).
 */
import type { Compte } from '../api/comptes'

const COLONNES = ['nom', 'email', 'provenance', 'departement', 'fragments', 'inscrit', 'derniere_visite', 'role'] as const

function cellule(v: string | number | null): string {
  const s = v === null ? '' : String(v)
  return /[;"\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

export function versCsv(lignes: Compte[]): string {
  return [COLONNES.join(';'), ...lignes.map((c) => COLONNES.map((k) => cellule(c[k])).join(';'))].join('\r\n')
}
