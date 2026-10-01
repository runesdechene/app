/**
 * QUOI     — préparer la carte pendant qu'on regarde un autre écran : son code, ses lieux et les
 *            icônes de leurs types arrivent en avance.
 * POURQUOI — Uriel, 02/10 : « la carte reste très longue à charger ». Au téléphone, l'app s'ouvre
 *            sur l'Accueil, et tout ce que demande la carte (MapLibre, 3 500 lieux, les icônes) ne
 *            partait qu'au moment où l'on touchait l'onglet. Deux secondes d'abord : l'Accueil est
 *            servi en premier.
 * ATTENTION — même clé et même lecture que `useCarteLieux` : la carte ouverte trouve ses lieux
 *            dans le cache, sans les redemander.
 */
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { fetchCarteLieux } from '../api/carte'
import { prechargerIcones } from '../lib/sceaux'
import { carteLieuxKey } from './useCarteLieux'

const AVANT_DE_PREPARER = 2000

export function usePreparerLaCarte() {
  const queryClient = useQueryClient()
  useEffect(() => {
    const minuteur = setTimeout(() => {
      void import('../components/CarteScreen')
      queryClient
        .query({ queryKey: carteLieuxKey, queryFn: fetchCarteLieux })
        .then(prechargerIcones)
        // Un échec ici ne dit rien : la carte, ouverte, redemandera ses lieux et le dira.
        .catch(() => undefined)
    }, AVANT_DE_PREPARER)
    return () => {
      clearTimeout(minuteur)
    }
  }, [queryClient])
}
