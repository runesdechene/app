/**
 * QUOI     — le fil du Registre : les messages, et entre eux qui a rejoint EXPLORE, rangés à
 *            leur heure.
 * POURQUOI — Uriel, 01/10 puis 05/10 : les bienvenues vivent dans le Registre ; les connexions,
 *            essayées, n'apportaient rien et ont été retirées. Une arrivée plus ancienne que le
 *            premier message chargé ne s'affiche pas : elle flotterait seule en haut, sans
 *            conversation autour.
 */
import type { Message, Passage } from '../api/lireRegistre'

export type Ligne =
  | { sorte: 'message'; quand: string; message: Message }
  | { sorte: 'arrivee'; quand: string; passage: Passage }

const heure = (quand: string) => new Date(quand).getTime()

export function entremeler(messages: Message[], arrivees: Passage[]): Ligne[] {
  const premier = messages[0]
  if (!premier) return []
  const lignes: Ligne[] = [
    ...messages.map((message) => ({ sorte: 'message' as const, quand: message.quand, message })),
    ...arrivees
      .filter((passage) => heure(passage.quand) >= heure(premier.quand))
      .map((passage) => ({ sorte: 'arrivee' as const, quand: passage.quand, passage })),
  ]
  return lignes.sort((a, b) => heure(a.quand) - heure(b.quand))
}
