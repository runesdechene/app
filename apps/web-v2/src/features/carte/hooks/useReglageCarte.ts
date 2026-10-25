/**
 * QUOI     — un réglage de la carte venu des Préférences (« Mes lieux en couleur », « Carte Skyrim »),
 *            à sa valeur par défaut tant qu'il n'est pas lu.
 * POURQUOI — la clé `['preferences', <réglage>]` est le contrat avec la zone Compte :
 *            quand l'Explorateur bascule l'option, les Préférences rafraîchissent cette clé
 *            et la carte se redessine sans qu'une zone importe l'autre.
 *            Un visiteur sans compte n'a pas de préférences : rien n'est demandé, il voit le défaut.
 * ATTENTION — `DEFAUT` suit les valeurs par défaut de la base (migrations 563 et 566).
 */
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { fetchReglageCarte, type ReglageCarte } from '../api/carte'
import type { StyleDesMarques } from '../lib/sceaux'

// Les deux allumés par défaut (Uriel, 24/10 et 25/10).
const DEFAUT: Record<ReglageCarte, boolean> = { lieuxEnCouleur: true, carteSkyrim: true }

export function useReglageCarte(reglage: ReglageCarte, actif: boolean): boolean {
  const query = useQuery({
    queryKey: ['preferences', reglage],
    queryFn: () => fetchReglageCarte(reglage),
    enabled: actif,
  })
  return query.data ?? DEFAUT[reglage]
}

// Les deux réglages qui changent les marques, en un objet stable : la carte ne se redessine que
// si l'un d'eux change.
export function useStyleDesMarques(actif: boolean): StyleDesMarques {
  const couleurTypes = useReglageCarte('lieuxEnCouleur', actif)
  const skyrim = useReglageCarte('carteSkyrim', actif)
  return useMemo(() => ({ couleurTypes, skyrim }), [couleurTypes, skyrim])
}
