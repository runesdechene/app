/**
 * QUOI     — la frise des époques en fonctions pures : la plage (deux rangs sur la frise) et
 *            l'ensemble d'époques qu'elle retient, les bornes et la phrase d'en-tête.
 * POURQUOI — spec 2026-10-10-frise-des-epoques : la frise remplit le même `Filtres.epoques` que
 *            les anciens boutons, `filtrer` ne change pas. Au repos, l'ensemble est vide : rien
 *            n'est filtré.
 * ATTENTION — la frise ne montre que les époques datées ; « Indéfinie » et « Non concerné »
 *            n'y sont jamais, une plage resserrée cache donc leurs lieux.
 */
import { anneeCourte, compteDuCalendrier, type Calendrier } from '@runes/calendrier'
import type { EpoqueFiltre } from '../api/lireCarte'

export type Plage = { de: number; a: number }

export function epoquesDatees(epoques: EpoqueFiltre[]): EpoqueFiltre[] {
  return epoques.filter((e) => e.debut !== null || e.fin !== null)
}

export function auRepos(frise: EpoqueFiltre[], p: Plage): boolean {
  return p.de === 0 && p.a === frise.length - 1
}

export function plageDe(frise: EpoqueFiltre[], choix: ReadonlySet<string>): Plage {
  const rangs = frise.flatMap((e, i) => (choix.has(e.id) ? [i] : []))
  if (rangs.length === 0) return { de: 0, a: frise.length - 1 }
  return { de: Math.min(...rangs), a: Math.max(...rangs) }
}

export function ensembleDe(frise: EpoqueFiltre[], p: Plage): ReadonlySet<string> {
  if (auRepos(frise, p)) return new Set()
  return new Set(frise.slice(p.de, p.a + 1).map((e) => e.id))
}

export function bornes(
  frise: EpoqueFiltre[],
  p: Plage,
  calendrier: Calendrier,
): { debut: string | null; fin: string | null } {
  const debut = frise[p.de]?.debut ?? null
  const fin = frise[p.a]?.fin ?? null
  return {
    debut: debut === null ? null : anneeCourte(debut, calendrier),
    fin: fin === null ? null : anneeCourte(fin, calendrier),
  }
}

export function enTete(
  frise: EpoqueFiltre[],
  p: Plage,
  calendrier: Calendrier,
): { titre: string; detail: string } {
  if (auRepos(frise, p)) {
    return { titre: 'Toutes les époques', detail: 'Glisse les poignées pour remonter le temps' }
  }
  const nomDe = frise[p.de]?.nom ?? ''
  const nomA = frise[p.a]?.nom ?? ''
  const { debut, fin } = bornes(frise, p, calendrier)
  return {
    titre: p.de === p.a ? nomDe : `${nomDe} → ${nomA}`,
    detail: `${debut === null ? 'des origines' : `de ${debut}`} à ${fin ?? 'aujourd’hui'} — ${compteDuCalendrier(calendrier)}`,
  }
}
