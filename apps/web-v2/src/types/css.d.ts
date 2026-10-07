/**
 * QUOI     — déclare les variables CSS que les composants passent en style inline.
 * POURQUOI — sans elle, TypeScript refuse '--nuance' ; un cast serait une rustine. Seules les
 *            variables listées ici peuvent passer en style inline.
 */
import 'react'

declare module 'react' {
  interface CSSProperties {
    '--avatar'?: string
    '--nuance'?: string
    '--mesure'?: string
    '--icone'?: string
    '--nombre'?: string
    '--rang'?: string
    '--couleur'?: string // la couleur d'une Compagnie (gélule, message, fiche — mig 422)
    '--encre-compagnie'?: string // son encre lisible sur le parchemin (shared/lib/teinte.ts)
    '--sur-couleur'?: string // la lettre posée sur sa couleur (l'initiale de l'avatar)
    '--type'?: string // la couleur d'un type de lieu (le badge de la fiche)
    '--avant'?: string // la jauge du niveau avant une découverte (elle se remplit jusqu'à --mesure)
    // La bannière de la boutique : les couleurs réglées dans le Hub, bannière par bannière.
    '--voile'?: string
    '--voile-force'?: string
    '--teinte-tag'?: string
    '--teinte-titre'?: string
    '--teinte-sous-titre'?: string
    '--ombre-texte'?: string
    '--ombre-force'?: string
    // Une énigme touchée : l'endroit du doigt (le sceau s'y retourne) et la couleur de sa culture.
    '--x'?: string
    '--y'?: string
    '--couleur-culture'?: string
    '--icone'?: string // l'icône d'une culture, en masque peint à sa couleur
  }
}
