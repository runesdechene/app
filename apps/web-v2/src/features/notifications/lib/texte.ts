/**
 * QUOI     — le texte d'une mise à jour, tel qu'on l'écrit dans le Hub, découpé en blocs : des
 *            paragraphes (séparés par une ligne vide) et des listes (les lignes qui commencent
 *            par « - »). Dans un point, ce qui précède « : » s'écrit en gras.
 * POURQUOI — Uriel écrit du texte simple, sans balises ; la page « Nouveautés » le met en forme.
 */
export type Point = { tete: string | null; reste: string }
export type Bloc = { sorte: 'paragraphe'; texte: string } | { sorte: 'liste'; points: Point[] }

function point(ligne: string): Point {
  const texte = ligne.replace(/^-\s*/, '')
  const coupure = texte.indexOf(' : ')
  return coupure > 0
    ? { tete: texte.slice(0, coupure), reste: texte.slice(coupure) }
    : { tete: null, reste: texte }
}

export function blocsDuTexte(texte: string): Bloc[] {
  const blocs: Bloc[] = []
  let precedente: 'vide' | 'texte' | 'point' = 'vide'

  for (const brute of texte.split('\n')) {
    const ligne = brute.trim()
    const dernier = blocs.at(-1)
    if (ligne === '') {
      precedente = 'vide'
    } else if (ligne.startsWith('-')) {
      if (precedente === 'point' && dernier?.sorte === 'liste') dernier.points.push(point(ligne))
      else blocs.push({ sorte: 'liste', points: [point(ligne)] })
      precedente = 'point'
    } else {
      if (precedente === 'texte' && dernier?.sorte === 'paragraphe') dernier.texte += ` ${ligne}`
      else blocs.push({ sorte: 'paragraphe', texte: ligne })
      precedente = 'texte'
    }
  }
  return blocs
}
