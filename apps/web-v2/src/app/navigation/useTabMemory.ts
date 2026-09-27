/**
 * QUOI     — retient la dernière adresse visitée dans chaque onglet.
 * POURQUOI — revenir sur un onglet rouvre là où on l'avait laissé (convention mobile).
 * ATTENTION — la mémoire s'ajuste PENDANT le rendu, pas dans un effet : c'est le motif
 *            recommandé par React pour un état dérivé d'une valeur qui change (ici l'URL) ;
 *            un effet provoquerait un second rendu à chaque navigation.
 *            Mémoire de session seulement : un rechargement repart des racines.
 */
import { useState } from 'react'
import { useLocation } from 'react-router'
import { tabOf, type TabId } from './tabs'

export function useTabMemory(): Partial<Record<TabId, string>> {
  const { pathname } = useLocation()
  const [memory, setMemory] = useState<Partial<Record<TabId, string>>>({})

  const tab = tabOf(pathname)
  if (tab && memory[tab] !== pathname) {
    setMemory({ ...memory, [tab]: pathname })
  }

  return memory
}
