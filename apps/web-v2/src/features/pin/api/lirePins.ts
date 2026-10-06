/**
 * QUOI     — lire les réponses des fonctions du pin (migration 428).
 * POURQUOI — la base renvoie du JSON : chaque champ est vérifié (shared/lib/lire).
 */
import type { Point } from '@/shared/lib/distance'
import { chaine, liste, nombre, objet, ouNull } from '@/shared/lib/lire'

export type Pin = { id: string; point: Point; lieuDit: string | null; poseLe: Date }
export type MesPins = { validiteJours: number; pins: Pin[] }
export type LieuProche = { id: string; nom: string; imageUrl: string | null; metres: number }

function pin(v: unknown): Pin {
  const o = objet(v)
  return {
    id: chaine(o.id),
    point: { latitude: nombre(o.latitude), longitude: nombre(o.longitude) },
    lieuDit: ouNull(chaine)(o.lieuDit),
    poseLe: new Date(chaine(o.poseLe)),
  }
}

export function lireMesPins(v: unknown): MesPins {
  const o = objet(v)
  return { validiteJours: nombre(o.validiteJours), pins: liste(pin)(o.pins) }
}

function lieuProche(v: unknown): LieuProche {
  const o = objet(v)
  const lieu = objet(o.lieu)
  return {
    id: chaine(lieu.id),
    nom: chaine(lieu.nom),
    imageUrl: ouNull(chaine)(lieu.imageUrl),
    metres: nombre(o.metres),
  }
}

export const lireLieuxProches = liste(lieuProche)
