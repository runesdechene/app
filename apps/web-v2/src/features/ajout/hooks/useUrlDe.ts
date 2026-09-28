/**
 * QUOI     — l'adresse (blob:) d'une photo du brouillon, pour l'afficher.
 * POURQUOI — les photos du brouillon sont des Blob (IndexedDB) : une balise <img> a besoin d'une
 *            adresse. Une seule par photo, retenue tant que la photo existe (WeakMap) : un
 *            brouillon compte dix photos au plus, deux tailles chacune. La libérer à chaque
 *            démontage casserait l'image au remontage (React le fait deux fois en développement).
 */
const ADRESSES = new WeakMap<Blob, string>()

export function useUrlDe(blob: Blob | null | undefined): string | null {
  if (!blob) return null
  let adresse = ADRESSES.get(blob)
  if (!adresse) {
    adresse = URL.createObjectURL(blob)
    ADRESSES.set(blob, adresse)
  }
  return adresse
}
