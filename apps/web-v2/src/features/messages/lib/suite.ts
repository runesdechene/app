/**
 * QUOI     — un message est-il la suite du précédent ? La même personne, moins de dix minutes
 *            après.
 * POURQUOI — Uriel, 28/09 : quand quelqu'un écrit plusieurs fois d'affilée, on ne répète ni son
 *            portrait ni son nom — juste le texte et l'heure, serrés. Après un silence, un nouveau
 *            bloc : la reprise ne semble pas collée à ce qui précédait.
 */
const DIX_MINUTES = 10 * 60 * 1000

type Message = { auteur: { id: string }; quand: string }

export function estLaSuite(precedent: Message | undefined, message: Message): boolean {
  if (!precedent || precedent.auteur.id !== message.auteur.id) return false
  return new Date(message.quand).getTime() - new Date(precedent.quand).getTime() < DIX_MINUTES
}
