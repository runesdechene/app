/**
 * QUOI     — les préférences en cache, et `regler` qui bascule un réglage.
 * POURQUOI — l'interrupteur bouge tout de suite (mise à jour optimiste) ; si la base refuse,
 *            SEUL ce réglage revient à sa place, et `echec` passe à vrai pour que l'écran le
 *            dise. Deux réglages touchés coup sur coup ne s'annulent donc jamais l'un l'autre.
 * ATTENTION — `cancelQueries` avant d'écrire : une relecture déjà partie ne vient pas écraser
 *            la valeur qu'on vient d'afficher.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  erreurChargement: boolean
  reessayer: () => void
  regler: (reglage: Reglage, valeur: boolean) => void
  echec: boolean
} {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: CLE, queryFn: mesPreferences })
  const [echec, setEchec] = useState(false)

  function afficher(reglage: Reglage, valeur: boolean) {
    queryClient.setQueryData<Preferences>(CLE, (p) => p && { ...p, [reglage]: valeur })
  }

  const mutation = useMutation({
    mutationFn: ({ reglage, valeur }: { reglage: Reglage; valeur: boolean }) =>
      ecrire(reglage, valeur),
    onMutate: async ({ reglage, valeur }) => {
      setEchec(false)
      await queryClient.cancelQueries({ queryKey: CLE })
      afficher(reglage, valeur)
    },
    onError: (_erreur, { reglage, valeur }) => {
      afficher(reglage, !valeur)
      setEchec(true)
    },
  })

  return {
    preferences: query.data,
    erreurChargement: query.isError,
    reessayer: () => {
      void query.refetch()
    },
    regler: (reglage, valeur) => {
      mutation.mutate({ reglage, valeur })
    },
    echec,
  }
}
