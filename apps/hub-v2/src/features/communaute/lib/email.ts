/**
 * QUOI     — le grand champ du stand : finir une adresse d'un toucher (@gmail.com, .fr…) et savoir
 *            quand elle est complète (le bouton « Créer ce compte » apparaît alors).
 * POURQUOI — fonctions pures : chaque règle se teste seule.
 */
export const FINS = ['@gmail.com', '@hotmail.fr', '@outlook.fr', '@icloud.com', '@yahoo.fr', '@orange.fr', '@free.fr', '@laposte.net', '@bluewin.ch', '.com', '.fr']

/** « @gmail.com » remplace ce qui suit l'arobase (ou s'ajoute) ; « .com » s'ajoute au bout. */
export function finirAdresse(texte: string, fin: string): string {
  const t = texte.trim()
  if (!fin.startsWith('@')) return t + fin
  const arobase = t.indexOf('@')
  return (arobase === -1 ? t : t.slice(0, arobase)) + fin
}

/** Une adresse complète : quelque chose, une arobase, un domaine avec un point et au moins deux lettres. */
export function adresseComplete(texte: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(texte.trim())
}
