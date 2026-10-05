/**
 * QUOI     — le fil du Registre : les messages, et entre eux les gens qui passent — qui a rejoint
 *            EXPLORE, qui s'est connecté —, rangés à leur heure.
 * POURQUOI — Uriel, 01/10 : les gens qui passent vivent dans le Registre, plus dans « Sur les
 *            chemins ». Puis, 05/10 : trop de lignes de connexion, la conversation s'y noyait —
 *            les connexions qui se suivent ne font plus qu'une ligne, et seulement celles des
 *            dernières 24 heures. Les arrivées, qu'on aime, restent une ligne chacune.
 *            Un passage plus ancien que le premier message chargé ne s'affiche pas : il
 *            flotterait seul en haut, sans conversation autour.
 */
import type { Message, Passage } from '../api/lireRegistre'

export type Ligne =
  | { sorte: 'message'; quand: string; message: Message }
  | { sorte: 'arrivee'; quand: string; passage: Passage }
  // Des connexions d'affilée ; la ligne prend l'heure de la dernière.
  | { sorte: 'connexions'; quand: string; passages: Passage[] }

const UN_JOUR = 24 * 60 * 60 * 1000
const heure = (quand: string) => new Date(quand).getTime()

function enLigne(passage: Passage): Ligne {
  return passage.type === 'arrivee'
    ? { sorte: 'arrivee', quand: passage.quand, passage }
    : { sorte: 'connexions', quand: passage.quand, passages: [passage] }
}

export function entremeler(
  messages: Message[],
  passages: Passage[],
  maintenant = Date.now(),
): Ligne[] {
  const premier = messages[0]
  if (!premier) return []
  const montres = passages.filter(
    (p) =>
      heure(p.quand) >= heure(premier.quand) &&
      (p.type === 'arrivee' || maintenant - heure(p.quand) < UN_JOUR),
  )
  const ranges: Ligne[] = [
    ...messages.map((message) => ({ sorte: 'message' as const, quand: message.quand, message })),
    ...montres.map(enLigne),
  ].sort((a, b) => heure(a.quand) - heure(b.quand))

  // Les connexions qui se suivent se rejoignent en une seule ligne.
  const fil: Ligne[] = []
  for (const ligne of ranges) {
    const avant = fil.at(-1)
    if (ligne.sorte === 'connexions' && avant?.sorte === 'connexions') {
      fil[fil.length - 1] = {
        sorte: 'connexions',
        quand: ligne.quand,
        passages: [...avant.passages, ...ligne.passages],
      }
    } else {
      fil.push(ligne)
    }
  }
  return fil
}
