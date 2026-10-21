/**
 * QUOI     — le lieu que la carte entoure d'un anneau quand on est sur place, et ce que la coquille
 *            pose sur la carte pour le proposer (le bouton « Marquer ma visite », zone lieu).
 * POURQUOI — spec « Revendiquer par GPS » (21/10) : la règle du lieu à portée vit avec la visite ;
 *            la carte, elle, ne fait que montrer l'anneau (le même que les lieux neufs).
 */
import { useEffect, useState, type ReactNode } from 'react'
import type { Map as Carte } from 'maplibre-gl'
import type { LieuCarte } from '../api/lireCarte'
import { montrerAPortee } from '../lib/nouveaux'

export type SurPlace = (lieux: LieuCarte[], signaler: (id: string | null) => void) => ReactNode

export function useAPortee(carte: Carte | null) {
  const [aPortee, setAPortee] = useState<string | null>(null)
  useEffect(() => {
    if (carte) montrerAPortee(carte, aPortee)
  }, [carte, aPortee])
  return setAPortee
}
