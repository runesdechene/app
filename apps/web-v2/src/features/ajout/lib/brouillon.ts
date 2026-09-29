/**
 * QUOI     — le brouillon d'un lieu en cours d'ajout, et ce qu'il lui manque à chaque étape.
 * POURQUOI — Uriel, 29/09 : « qu'on puisse save le brouillon à tout moment ». Il se garde dans
 *            IndexedDB (idb-keyval), le seul stockage du navigateur qui garde des photos entières
 *            (des Blob) — le localStorage n'en veut pas. Un seul brouillon à la fois : rouvrir
 *            « Ajouter » propose de le reprendre, à l'étape où on l'a laissé.
 *            Un bouton grisé dit toujours ce qui manque (la V1 ne le disait jamais).
 */
import type { PhotoAEnvoyer } from '@/shared/lib/photo'
import { del, get, set } from 'idb-keyval'
import type { Point } from '@/shared/lib/distance'
import type { Endroit } from './adresse'

export const ETAPES = ['photo', 'lieu', 'nom', 'recit', 'apercu'] as const
export type Etape = (typeof ETAPES)[number]

export type PhotoBrouillon = PhotoAEnvoyer

export type Brouillon = {
  etape: Etape
  photos: PhotoBrouillon[]
  positionPhoto: Point | null // lue dans la première photo, si l'appareil l'a notée
  point: Point | null
  endroit: Endroit | null
  nom: string
  natures: string[] // une à trois ; la première est la principale
  epoque: string | null // null : « je ne sais pas »
  annee: number | null
  recit: string
}

export const BROUILLON_VIDE: Brouillon = {
  etape: 'photo',
  photos: [],
  positionPhoto: null,
  point: null,
  endroit: null,
  nom: '',
  natures: [],
  epoque: null,
  annee: null,
  recit: '',
}

// Ce que chaque étape reçoit du parcours.
export type ProprietesEtape = {
  brouillon: Brouillon
  changer: (modif: Partial<Brouillon>) => void
  onSuivant: () => void
}

// Ce qui empêche de quitter une étape ; null : on peut avancer.
export function ceQuiManque(b: Brouillon, etape: Etape): string | null {
  switch (etape) {
    case 'photo':
      return b.photos.length === 0 ? 'Une photo, au moins' : null
    case 'lieu':
      return b.point === null ? 'Place le lieu sur la carte' : null
    case 'nom':
      if (b.nom.trim() === '') return 'Il lui faut un nom'
      return b.natures.length === 0 ? 'Choisis sa nature' : null
    case 'recit':
      return b.recit.trim() === '' ? 'Quelques mots, au moins' : null
    case 'apercu':
      return null
  }
}

// L'étape la plus loin où l'on peut être : la première qui n'est pas complète.
export function derniereEtapePossible(b: Brouillon): Etape {
  return ETAPES.find((e) => ceQuiManque(b, e) !== null) ?? 'apercu'
}

// L'étape où reprendre : celle qu'on avait quittée, sauf si le brouillon ne permet pas d'y être.
export function etapeDeReprise(b: Brouillon): Etape {
  const possible = derniereEtapePossible(b)
  return ETAPES.indexOf(b.etape) <= ETAPES.indexOf(possible) ? b.etape : possible
}

const CLE = 'runes-de-chene/ajout-lieu'

export async function chargerBrouillon(): Promise<Brouillon | null> {
  try {
    const b = await get<Brouillon>(CLE)
    return b ? { ...BROUILLON_VIDE, ...b } : null
  } catch {
    return null // navigation privée, stockage refusé : on repart d'un brouillon vide
  }
}

export async function enregistrerBrouillon(b: Brouillon): Promise<void> {
  await set(CLE, b)
}

export async function jeterBrouillon(): Promise<void> {
  await del(CLE)
}
