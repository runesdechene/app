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
    '--type'?: string // la couleur d'un type de lieu (le badge de la fiche)
  }
}
