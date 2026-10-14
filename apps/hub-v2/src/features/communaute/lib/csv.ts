/**
 * QUOI     — la liste des comptes en CSV (séparateur « ; », que le tableur français ouvre sans question).
 */
import type { Compte } from '../api/comptes'

const COLONNES = ['nom', 'email', 'provenance', 'departement', 'fragments', 'inscrit', 'derniere_visite', 'role'] as const
const DEBUT_DE_FORMULE = /^[=+\-@\t\r]/

function cellule(v: string | number | null): string {
  const texte = v === null ? '' : String(v)
  // Un tableur lit « =… » comme une formule : on la neutralise d'une apostrophe.
  const s = DEBUT_DE_FORMULE.test(texte) ? `'${texte}` : texte
  return /[;"\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

export function versCsv(lignes: Compte[]): string {
  return [COLONNES.join(';'), ...lignes.map((c) => COLONNES.map((k) => cellule(c[k])).join(';'))].join('\r\n')
}
