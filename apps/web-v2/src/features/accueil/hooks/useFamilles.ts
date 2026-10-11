/**
 * QUOI     — les familles allumées dans « Sur les chemins », et le geste qui en bascule une.
 * POURQUOI — le choix vit sur l'appareil (Uriel, 11/10) : il se lit à l'ouverture et s'écrit à
 *            chaque bascule. L'Accueil et la page du fil le lisent chacun à leur ouverture.
 */
import { useState } from 'react'
import { basculerFamille, garderFamilles, lireFamilles, type Famille } from '../lib/familles'

// Le stockage de l'appareil, s'il est permis (il peut être refusé : navigation privée).
function stockage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function useFamilles() {
  const [allumees, setAllumees] = useState(() => lireFamilles(stockage()))
  const basculer = (f: Famille) => {
    const apres = basculerFamille(allumees, f)
    garderFamilles(stockage(), apres)
    setAllumees(apres)
  }
  return { allumees, basculer }
}
