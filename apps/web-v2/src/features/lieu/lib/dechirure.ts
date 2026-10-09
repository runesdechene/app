/**
 * QUOI     — la géométrie de la déchirure : la forme irrégulière d'un coup de doigt, le recadrage
 *            d'une photo « comme object-fit: cover », et la part du voile déjà grattée.
 * POURQUOI — des fonctions pures, sans canevas : elles se lisent et se testent seules. Le dessin
 *            vit dans `voile.ts`.
 */
export type Point = { x: number; y: number }

// Un coup de doigt : un cercle cabossé. `alea` rend un nombre entre 0 et 1 (Math.random en vrai).
export function forme(centre: Point, rayon: number, alea: () => number): Point[] {
  const cotes = 14
  return Array.from({ length: cotes }, (_, i) => {
    const angle = (i / cotes) * Math.PI * 2
    const r = rayon * (0.75 + alea() * 0.45)
    return { x: centre.x + Math.cos(angle) * r, y: centre.y + Math.sin(angle) * r }
  })
}

// Les points où poser un coup de doigt entre deux positions : sans eux, un geste rapide
// laisserait des trous en pointillé.
export function jalons(de: Point, a: Point, pas: number): Point[] {
  const n = Math.max(1, Math.ceil(Math.hypot(a.x - de.x, a.y - de.y) / pas))
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 1) / n
    return { x: de.x + (a.x - de.x) * t, y: de.y + (a.y - de.y) * t }
  })
}

// La partie de l'image à garder pour remplir un cadre sans la déformer (comme `object-fit: cover`).
export function couvrir(image: { l: number; h: number }, cadre: { l: number; h: number }) {
  const echelle = Math.max(cadre.l / image.l, cadre.h / image.h)
  const l = cadre.l / echelle
  const h = cadre.h / echelle
  return { x: (image.l - l) / 2, y: (image.h - h) / 2, l, h }
}

// Le voile découpé en cases : une case touchée par le doigt compte comme grattée.
export class Grille {
  private readonly touchees = new Set<number>()
  private readonly colonnes: number
  private readonly lignes: number

  constructor(
    private readonly largeur: number,
    private readonly hauteur: number,
    private readonly cote = 24,
  ) {
    this.colonnes = Math.max(1, Math.ceil(largeur / cote))
    this.lignes = Math.max(1, Math.ceil(hauteur / cote))
  }

  gratter(p: Point, rayon: number) {
    for (let c = 0; c < this.colonnes; c++) {
      for (let l = 0; l < this.lignes; l++) {
        const x = Math.min((c + 0.5) * this.cote, this.largeur)
        const y = Math.min((l + 0.5) * this.cote, this.hauteur)
        if (Math.hypot(x - p.x, y - p.y) <= rayon) this.touchees.add(l * this.colonnes + c)
      }
    }
  }

  part(): number {
    return this.touchees.size / (this.colonnes * this.lignes)
  }
}
