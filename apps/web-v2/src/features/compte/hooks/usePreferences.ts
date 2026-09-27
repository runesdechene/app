/**
 * QUOI     — les préférences en cache, et `regler` qui bascule un réglage.
 * POURQUOI — l'interrupteur bouge tout de suite (mise à jour optimiste) ; si la base refuse,
 *            il revient à sa place et `echec` passe à vrai pour que l'écran le dise.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  mesPreferences,
  reglerBrouillage,
  reglerPreference,
  type ClePreference,
  type Preferences,
} from '../api/preferences'

export type Reglage =
  'pushImportant' | 'pushRecap' | 'brouillerPistes' | 'showDepartement' | 'showEnvies'

const CLES: Record<Exclude<Reglage, 'brouillerPistes'>, ClePreference> = {
  pushImportant: 'push_important_enabled',
  pushRecap: 'push_recap_enabled',
  showDepartement: 'show_departement',
  showEnvies: 'show_envies',
}

function ecrire(reglage: Reglage, valeur: boolean): Promise<void> {
  if (reglage === 'brouillerPistes') return reglerBrouillage(valeur)
  return reglerPreference(CLES[reglage], valeur)
}

const CLE = ['preferences']

// L'écran passe par ce hook pour tout ce qui touche la base : l'adresse du formulaire du Hub
// et le changement d'e-mail en font partie.
export { changerEmail, SOUMETTRE_PHOTO_URL } from '../api/preferences'

export function usePreferences(): {
  preferences: Preferences | undefined
  regler: (reglage: Reglage, valeur: boolean) => void
  echec: boolean
} {
  const queryClient = useQueryClient()
  const { data } = useQuery({ queryKey: CLE, queryFn: mesPreferences })
  const [echec, setEchec] = useState(false)

  function regler(reglage: Reglage, valeur: boolean) {
    const avant = queryClient.getQueryData<Preferences>(CLE)
    if (!avant) return
    setEchec(false)
    queryClient.setQueryData<Preferences>(CLE, { ...avant, [reglage]: valeur })
    ecrire(reglage, valeur).catch(() => {
      queryClient.setQueryData<Preferences>(CLE, avant)
      setEchec(true)
    })
  }

  return { preferences: data, regler, echec }
}
