/**
 * QUOI     — la jauge d'énergie lue depuis `mon_energie` (migration 399).
 * POURQUOI — `prochainDans` est null quand la jauge est pleine : rien ne revient.
 */
import { nombre, objet, ouNull } from '@/shared/lib/lire'

export type Energie = { points: number; max: number; prochainDans: number | null; parPoint: number }

export function lireEnergie(json: unknown): Energie {
  const e = objet(json)
  return {
    points: nombre(e.points),
    max: nombre(e.max),
    prochainDans: ouNull(nombre)(e.prochainDans),
    parPoint: nombre(e.parPoint),
  }
}
