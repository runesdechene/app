/**
 * QUOI     — le fil du Registre : les messages, et entre eux qui a rejoint EXPLORE, rangés à
 *            leur heure ; les arrivées d'affilée, le même jour, ne font qu'une ligne.
 * POURQUOI — Uriel, 01/10 puis 05/10 : les bienvenues vivent dans le Registre ; les connexions,
 *            essayées, n'apportaient rien et ont été retirées ; les arrivées qui se suivent se
 *            regroupent. Une arrivée plus ancienne que le premier message chargé (`depuis`, quels
 *            que soient les canaux cochés) ne s'affiche pas : elle flotterait seule en haut, sans
 *            conversation autour.
 */
import type { Message, Passage } from '../api/lireRegistre'
import { autreJour } from './jour'

export type Ligne =
  | { sorte: 'message'; quand: string; message: Message }
  // Des arrivées d'affilée ; la ligne prend l'heure de la dernière.
  | { sorte: 'arrivees'; quand: string; passages: Passage[] }

const heure = (quand: string) => new Date(quand).getTime()

export function entremeler(
  messages: Message[],
  arrivees: Passage[],
  depuis: string | undefined,
): Ligne[] {
  if (depuis === undefined) return []
  const ranges: Ligne[] = [
    ...messages.map((message) => ({ sorte: 'message' as const, quand: message.quand, message })),
    ...arrivees
      .filter((passage) => heure(passage.quand) >= heure(depuis))
      .map((passage) => ({
        sorte: 'arrivees' as const,
        quand: passage.quand,
        passages: [passage],
      })),
  ].sort((a, b) => heure(a.quand) - heure(b.quand))

  // Les arrivées qui se suivent, le même jour, se rejoignent en une seule ligne.
  const fil: Ligne[] = []
  for (const ligne of ranges) {
    const avant = fil.at(-1)
    if (
      ligne.sorte === 'arrivees' &&
      avant?.sorte === 'arrivees' &&
      !autreJour(avant.quand, ligne.quand)
    ) {
      fil[fil.length - 1] = {
        sorte: 'arrivees',
        quand: ligne.quand,
        passages: [...avant.passages, ...ligne.passages],
      }
    } else {
      fil.push(ligne)
    }
  }
  return fil
}
