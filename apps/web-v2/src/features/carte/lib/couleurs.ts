/**
 * QUOI     — les couleurs de la carte, lues dans les jetons `--color-carte-*` de tokens.css.
 * POURQUOI — MapLibre dessine dans un canevas et ne connaît pas les variables CSS : on lit leur
 *            valeur une fois, au démarrage, et on la lui passe.
 */
export type CouleursCarte = {
  fond: string
  eau: string
  route: string
  encre: string
  halo: string
  foret: string
  ombre: string
}

export function lireCouleurs(racine: HTMLElement): CouleursCarte {
  const style = getComputedStyle(racine)
  const jeton = (nom: keyof CouleursCarte) => style.getPropertyValue(`--color-carte-${nom}`).trim()
  return {
    fond: jeton('fond'),
    eau: jeton('eau'),
    route: jeton('route'),
    encre: jeton('encre'),
    halo: jeton('halo'),
    foret: jeton('foret'),
    ombre: jeton('ombre'),
  }
}
