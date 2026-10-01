/**
 * QUOI     — le fil du Registre : les messages, et entre eux les gens qui passent (qui a rejoint
 *            EXPLORE, qui vient de se connecter), rangés à leur heure.
 * POURQUOI — Uriel, 01/10 : les gens qui passent vivent dans le Registre, plus dans « Sur les
 *            chemins ». Un passage plus ancien que le premier message chargé ne s'affiche pas :
 *            il flotterait seul en haut, sans conversation autour.
 */
import type { Message, Passage } from '../api/lireRegistre'

export type Ligne =
  | { sorte: 'message'; quand: string; message: Message }
  | { sorte: 'passage'; quand: string; passage: Passage }

const heure = (quand: string) => new Date(quand).getTime()

export function entremeler(messages: Message[], passages: Passage[]): Ligne[] {
  const premier = messages[0]
  if (!premier) return []
  const lignes: Ligne[] = [
    ...messages.map((message) => ({ sorte: 'message' as const, quand: message.quand, message })),
    ...passages
      .filter((passage) => heure(passage.quand) >= heure(premier.quand))
      .map((passage) => ({ sorte: 'passage' as const, quand: passage.quand, passage })),
  ]
  return lignes.sort((a, b) => heure(a.quand) - heure(b.quand))
}
