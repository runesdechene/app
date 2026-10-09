/**
 * QUOI     — la jauge d'énergie lue depuis `mon_energie` (migration 399).
 * POURQUOI — `prochainDans` est null quand la jauge est pleine : rien ne revient. La règle
 *            (distances et prix) vient de la base, réglée dans le Hub : l'écran ne l'invente pas.
 */
import { nombre, objet, ouNull } from '@/shared/lib/lire'

export type Regle = {
  gratuitKm: number
  palier1Km: number
  palier2Km: number
  palier3Km: number
  cout1: number
  cout2: number
  cout3: number
  cout4: number
}

export type Energie = {
  points: number
  max: number
  prochainDans: number | null
  parPoint: number
  regle: Regle
}

function lireRegle(json: unknown): Regle {
  const r = objet(json)
  return {
    gratuitKm: nombre(r.gratuitKm),
    palier1Km: nombre(r.palier1Km),
    palier2Km: nombre(r.palier2Km),
    palier3Km: nombre(r.palier3Km),
    cout1: nombre(r.cout1),
    cout2: nombre(r.cout2),
    cout3: nombre(r.cout3),
    cout4: nombre(r.cout4),
  }
}

export function lireEnergie(json: unknown): Energie {
  const e = objet(json)
  return {
    points: nombre(e.points),
    max: nombre(e.max),
    prochainDans: ouNull(nombre)(e.prochainDans),
    parPoint: nombre(e.parPoint),
    regle: lireRegle(e.regle),
  }
}
