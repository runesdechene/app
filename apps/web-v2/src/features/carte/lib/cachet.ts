/**
 * QUOI     — le bord irrégulier d'un cachet de cire, en chemin SVG (repère 96 × 96, centré) : le sceau
 *            « ? » de la carte et les deux faces du sceau qui se retourne.
 * POURQUOI — choix d'Uriel (07/10) : au toucher, un vrai cachet se retourne, à la couleur et au logo
 *            de la culture. Un cercle parfait faisait pastille ; la cire coule et ondule.
 */
// `n` bosses autour d'un cercle de rayon `r`, reliées par des courbes : le même bord à chaque dessin.
function bordDeCire(r: number, n: number, ampleur: number): string {
  const points = Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * Math.PI * 2
    const rayon = r + (i % 2 ? ampleur : -ampleur * 0.4) + Math.sin(i * 2.3) * ampleur * 0.5
    return [48 + rayon * Math.cos(angle), 48 + rayon * Math.sin(angle)] as const
  })
  const milieu = (a: readonly [number, number], b: readonly [number, number]) =>
    `${((a[0] + b[0]) / 2).toFixed(1)} ${((a[1] + b[1]) / 2).toFixed(1)}`
  const premier = points[0] ?? [48, 48]
  const dernier = points[n - 1] ?? premier
  const courbes = points.map((p, i) => `Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${milieu(p, points[(i + 1) % n] ?? premier)}`)
  return `M${milieu(premier, dernier)} ${courbes.join(' ')}Z`
}

export const BORD_DE_CIRE = bordDeCire(42, 16, 3.2)
