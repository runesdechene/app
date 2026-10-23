/**
 * QUOI     — les liens d'une lettre, pour les régler dans le panneau : la zone (chemin pointé), le texte du lien
 *            tel qu'il se lit dans l'e-mail, et l'adresse.
 * POURQUOI — dans l'e-mail, un clic sur un lien sert à en changer le texte ; son adresse se règle à part.
 */
import type { Lettre } from '@runes/missives'

export type LienDeLettre = { zone: string; texte: string; adresse: string }

export function liensDe(lettre: Lettre): LienDeLettre[] {
  if (lettre.modele === 'missive') {
    const c = lettre.contenu
    return [
      ...c.nouvelles.map((n, i) => ({ zone: `nouvelles.${String(i)}.appel.lien`, texte: n.appel.texte, adresse: n.appel.lien })),
      { zone: 'rupture.appel.lien', texte: c.rupture.appel.texte, adresse: c.rupture.appel.lien },
    ]
  }
  if (lettre.modele === 'fragment') {
    const c = lettre.contenu
    return [
      { zone: 'histoire.lien', texte: c.histoire.texte, adresse: c.histoire.lien },
      { zone: 'appel.lien', texte: c.appel.texte, adresse: c.appel.lien },
    ]
  }
  const c = lettre.contenu
  return [
    ...c.rupture.haltes.map((h, i) => ({ zone: `rupture.haltes.${String(i)}.lien`, texte: h.lieu, adresse: h.lien })),
    { zone: 'rupture.appel.lien', texte: c.rupture.appel.texte, adresse: c.rupture.appel.lien },
  ]
}
