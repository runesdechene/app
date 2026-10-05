/**
 * QUOI     — la phrase d'une ligne d'arrivées du Registre : « Kelpie a rejoint EXPLORE ! », ou,
 *            à plusieurs, « Kelpie et Ash ont rejoint… », « Kelpie, Ash et 4 autres… ».
 * POURQUOI — Uriel, 05/10 : les arrivées d'affilée en une ligne.
 */
export function phraseDesArrivees(noms: string[]) {
  const [a = '', b = '', c = ''] = noms
  const seul = noms.length === 1
  const qui =
    noms.length <= 1
      ? a
      : noms.length === 2
        ? `${a} et ${b}`
        : noms.length === 3
          ? `${a}, ${b} et ${c}`
          : `${a}, ${b} et ${String(noms.length - 2)} autres`
  return { qui, verbe: seul ? 'a rejoint EXPLORE !' : 'ont rejoint EXPLORE !' }
}
