/** QUOI — une couleur de Compagnie : un code #RRGGBB (la même règle que la base, mig 516). */
export function couleurValide(c: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(c)
}
