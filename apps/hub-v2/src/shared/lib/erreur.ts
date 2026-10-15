/**
 * QUOI     — le texte d'une erreur attrapée (`catch (e)` : `e` est `unknown`).
 * POURQUOI — une seule règle partout : le message d'une Error, sinon le texte de la valeur lancée.
 */
export function messageDErreur(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
