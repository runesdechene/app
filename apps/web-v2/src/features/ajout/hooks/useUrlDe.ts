/**
 * QUOI     — l'adresse (blob:) d'une photo du brouillon, pour l'afficher.
 * POURQUOI — les photos du brouillon sont des Blob (IndexedDB) : une balise <img> a besoin d'une
 *            adresse. Une seule par photo, partagée par tous les écrans qui la montrent, et libérée
 *            une seconde après que le dernier l'a quittée.
 * ATTENTION — la libération attend : React démonte puis remonte en développement, et une étape
 *            remplace l'autre dans la même seconde. Une adresse reprise entre-temps reste valable.
 */
import { useEffect } from 'react'

const DELAI = 1000

type Entree = { adresse: string; usages: number; liberation: ReturnType<typeof setTimeout> | null }
const ADRESSES = new Map<Blob, Entree>()

function liberer(blob: Blob, entree: Entree) {
  entree.liberation = setTimeout(() => {
    URL.revokeObjectURL(entree.adresse)
    ADRESSES.delete(blob)
  }, DELAI)
}

// Créée au rendu, l'adresse se libère d'elle-même si aucun écran ne la retient.
function adresseDe(blob: Blob) {
  let entree = ADRESSES.get(blob)
  if (!entree) {
    entree = { adresse: URL.createObjectURL(blob), usages: 0, liberation: null }
    ADRESSES.set(blob, entree)
    liberer(blob, entree)
  }
  return entree
}

export function useUrlDe(blob: Blob | null | undefined): string | null {
  const adresse = blob ? adresseDe(blob).adresse : null

  useEffect(() => {
    if (!blob) return
    const entree = adresseDe(blob)
    if (entree.liberation) clearTimeout(entree.liberation)
    entree.liberation = null
    entree.usages += 1
    return () => {
      entree.usages -= 1
      if (entree.usages === 0) liberer(blob, entree)
    }
  }, [blob])

  return adresse
}
