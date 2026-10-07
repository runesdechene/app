/**
 * QUOI     — ce que la feuille d'une énigme dit après la réponse : les gains, la part de la culture
 *            connue, le prochain titre, ce qui attend encore sur la carte, et l'erreur.
 * POURQUOI — maquette « Énigmes — 5 ». « Byzance : tu en connais 12 % » plutôt qu'une phrase qui
 *            accorderait le nom de chaque culture (« de la Grèce », « de Rome »…).
 */
import { objet } from '@/shared/lib/lire'
import type { Verdict } from '../api/lireEnigmes'

// Le mot d'une bonne réponse, tiré au sort (maquette « Énigmes — 5b », validée le 07/10).
export const MOTS_DE_FETE = ['Bien vu !', 'Juste !', 'Les dieux t’approuvent', 'Tu le savais !']

export function motDeFete(alea: number): string {
  return MOTS_DE_FETE[Math.min(MOTS_DE_FETE.length - 1, Math.floor(alea * MOTS_DE_FETE.length))] ?? 'Juste !'
}

export function gainsEnClair(v: Verdict, culture: string): string[] {
  const gains: string[] = []
  if (v.xp > 0) gains.push(`+${String(v.xp)} XP`)
  if (v.gagnes > 0) gains.push(`+${String(v.gagnes)} connaissance · ${culture}`)
  return gains
}

export function connaissanceEnClair(points: number, total: number, culture: string): string {
  const part = total > 0 ? Math.floor((points / total) * 100) : 0
  return `${culture} : tu en connais ${String(part)} %.`
}

export function prochainEnClair(v: Verdict, culture: string): string {
  if (!v.prochain) return `Tous les titres de ${culture} sont à toi.`
  const reste = Math.max(0, v.prochain.seuil - v.points)
  return `Encore ${String(reste)} ${reste > 1 ? 'points' : 'point'} pour « ${v.prochain.nom} ».`
}

// La relance sous le verdict : ce qui attend encore sur la carte, en titre et en phrase.
export function relanceEnClair(reste: number): { titre: string; phrase: string } {
  if (reste === 0) return { titre: 'C’était le dernier « ? »', phrase: 'D’autres s’éveillent chaque matin.' }
  if (reste === 1) return { titre: 'Encore un « ? »', phrase: 'Il t’attend sur la carte.' }
  return { titre: `Encore ${String(reste)} « ? »`, phrase: 'Ils t’attendent sur la carte.' }
}

// `P0002` : l'éveil s'est effacé (le réveil du matin) ou a déjà reçu sa réponse.
export function messageErreur(e: unknown): string {
  try {
    if (objet(e).code === 'P0002') return 'Cette énigme s’est rendormie.'
  } catch {
    // pas un objet : erreur réseau ou autre
  }
  return 'La réponse n’est pas partie. Réessaie.'
}
