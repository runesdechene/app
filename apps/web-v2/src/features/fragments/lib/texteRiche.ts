/**
 * QUOI     — le récit d'un Fragment, tel que Shopify le garde (texte riche en JSON : `root` >
 *            paragraphes, titres, listes > textes gras ou italiques), en blocs simples à afficher.
 * POURQUOI — l'italique et le gras portent le sens du récit (« hoplon », « Hopla ») : on les garde.
 *            Un texte qui n'est pas du JSON (saisi à la main) devient un bloc par paragraphe.
 */
export type Segment = { texte: string; gras: boolean; italique: boolean }
export type Bloc = Segment[]

type Noeud = { type?: string; value?: string; bold?: boolean; italic?: boolean; children?: Noeud[] }

function segments(n: Noeud): Segment[] {
  if (n.type === 'text') return [{ texte: n.value ?? '', gras: n.bold === true, italique: n.italic === true }]
  return (n.children ?? []).flatMap(segments)
}

// Un paragraphe ou un titre fait un bloc ; une liste, un bloc par élément.
function blocs(n: Noeud): Bloc[] {
  if (n.type === 'list') return (n.children ?? []).map(segments)
  return [segments(n)]
}

const plein = (b: Bloc) => b.some((s) => s.texte.trim() !== '')

export function lireTexteRiche(valeur: string | null): Bloc[] {
  if (!valeur) return []
  let racine: Noeud
  try {
    racine = JSON.parse(valeur) as Noeud
  } catch {
    return valeur
      .split(/\n\s*\n/)
      .map((p) => [{ texte: p.trim(), gras: false, italique: false }])
      .filter(plein)
  }
  return (racine.children ?? []).flatMap(blocs).filter(plein)
}
