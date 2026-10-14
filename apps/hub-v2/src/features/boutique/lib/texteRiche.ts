/**
 * QUOI     — le texte riche de Shopify (JSON `root` > paragraphes > textes) en paragraphes simples.
 * POURQUOI — le champ « son histoire » d'une Illustration arrive en JSON ; le Hub n'en montre que le texte.
 */
type Noeud = { value?: string; children?: Noeud[] }

const texte = (n: Noeud): string => n.value ?? (n.children ?? []).map(texte).join('')

export function texteRiche(valeur: string | null): string {
  if (!valeur) return ''
  let racine: unknown
  try {
    racine = JSON.parse(valeur)
  } catch {
    return valeur // déjà du texte simple
  }
  // « 2026 » ou « null » sont du JSON valide mais pas du texte riche : le texte passe tel quel.
  if (typeof racine !== 'object' || racine === null) return valeur
  return ((racine as Noeud).children ?? []).map(texte).join('\n\n')
}
