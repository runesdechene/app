/**
 * QUOI     — la phrase d'une ligne de connexions du Registre : « Kelpie vient de se connecter »,
 *            « Kelpie et Ash se sont connectés », « Kelpie, Ash et 4 autres se sont connectés ».
 * POURQUOI — Uriel, 05/10 : une ligne pour toutes les connexions d'affilée, pas une chacune.
 */
export function phraseDesConnexions(noms: string[]): string {
  const [a, b, c] = noms
  if (noms.length === 1) return `${a ?? ''} vient de se connecter`
  if (noms.length === 2) return `${a ?? ''} et ${b ?? ''} se sont connectés`
  if (noms.length === 3) return `${a ?? ''}, ${b ?? ''} et ${c ?? ''} se sont connectés`
  return `${a ?? ''}, ${b ?? ''} et ${String(noms.length - 2)} autres se sont connectés`
}
