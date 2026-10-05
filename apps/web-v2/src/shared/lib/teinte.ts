/**
 * QUOI     — la teinte d'une Compagnie, à poser en style : sa couleur, son encre lisible, et la
 *            couleur d'une lettre posée sur elle (l'initiale de l'avatar).
 * POURQUOI — la couleur est libre, le blanc compris (« La blanche hermine ») : utilisée telle quelle
 *            en texte, une couleur claire disparaît sur le parchemin. On règle au rendu, jamais à la
 *            saisie (.claude/rules/interface.md, « reference_faction_color_readable_ink ») : l'encre
 *            mêle 40 % de la couleur à l'encre, puis fonce jusqu'au contraste AA (4,5:1) sur la
 *            gélule — un fond de parchemin voilé de 18 % de la couleur.
 * ATTENTION — FOND et ENCRE recopient `--color-fond` et `--color-encre` de tokens.css ; le test des
 *            jetons vérifie qu'ils n'en divergent pas.
 */
export const FOND = '#fcf3e4'
export const ENCRE = '#494841'

type Rvb = [number, number, number]

function lire(hex: string): Rvb {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function ecrire([r, v, b]: Rvb): string {
  return '#' + [r, v, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')
}

// `part` de la couleur `a`, le reste de `b` — comme color-mix(in srgb, a part, b).
function meler(a: string, b: string, part: number): string {
  const [x, y] = [lire(a), lire(b)]
  const m = (i: 0 | 1 | 2) => x[i] * part + y[i] * (1 - part)
  return ecrire([m(0), m(1), m(2)])
}

function lineaire(x: number): number {
  const c = x / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const [r, v, b] = lire(hex)
  return 0.2126 * lineaire(r) + 0.7152 * lineaire(v) + 0.0722 * lineaire(b)
}

// Le rapport de contraste WCAG entre deux couleurs (de 1 à 21).
export function contraste(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)]
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

export function teinteCompagnie(couleur: string) {
  const gelule = meler(couleur, FOND, 0.18)
  // De 40 % de la couleur vers l'encre pure, qui est toujours lisible (≈ 8,9:1).
  let part = 0.4
  while (part > 0 && contraste(meler(couleur, ENCRE, part), gelule) < 4.5) part -= 0.05
  return {
    '--couleur': couleur,
    '--encre-compagnie': meler(couleur, ENCRE, Math.max(part, 0)),
    '--sur-couleur': contraste(FOND, couleur) >= 3 ? 'var(--color-fond)' : 'var(--color-encre)',
  }
}
