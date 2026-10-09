/**
 * QUOI     — tout ce que « Modifier mon profil » lit, et la fonction qui enregistre.
 * POURQUOI — l'écran reçoit ses valeurs de départ en une fois (`initial`, undefined tant que
 *            tout n'est pas chargé) et un seul `enregistrer`, qui fait les écritures dans
 *            l'ordre puis rafraîchit le profil en cache.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Titre } from '../api/lireProfil'
import { changerAvatar } from '../api/avatar'
import { choisirAccord, choisirTitres, enregistrerProfil, titresDebloques } from '../api/monProfil'
import { mesPreferences } from '../api/preferences'
import { explorateurKey, useExplorateur } from './useExplorateur'
import { useMonIdentifiant } from './useMonIdentifiant'

export type ValeursProfil = {
  nom: string
  bio: string
  instagram: string
  avatarUrl: string | null
  titres: number[]
  accord: 'm' | 'f'
}

export function useModifierProfil(): {
  initial: ValeursProfil | undefined
  titresDebloques: Titre[]
  erreur: boolean
  reessayer: () => void
  enregistrer: (valeurs: ValeursProfil, photo: File | null) => Promise<void>
} {
  const moi = useMonIdentifiant()
  const queryClient = useQueryClient()
  const explorateur = useExplorateur(moi)
  const profil = explorateur.profil
  const titres = useQuery({
    queryKey: ['titres-debloques', moi],
    queryFn: titresDebloques,
    enabled: moi !== null,
  })
  const preferences = useQuery({ queryKey: ['preferences'], queryFn: mesPreferences })

  const initial =
    profil && titres.data && preferences.data
      ? {
          nom: profil.nom,
          bio: profil.bio ?? '',
          instagram: profil.instagram ?? '',
          avatarUrl: profil.avatarUrl,
          titres: profil.titres.map((t) => t.id),
          accord: preferences.data.titleGender,
        }
      : undefined

  // Les titres ne s'écrivent que s'ils ont changé : la V1 range dans la même liste des titres
  // que la V2 ne montre pas (Compagnie, mots de fragment), qu'un simple changement de
  // présentation ne doit pas effacer. Le cache se rafraîchit même après un échec partiel.
  async function enregistrer(v: ValeursProfil, photo: File | null) {
    try {
      await enregistrerProfil({ nom: v.nom, bio: v.bio, instagram: v.instagram })
      if (photo) await changerAvatar(photo)
      if (initial && v.titres.join() !== initial.titres.join()) await choisirTitres(v.titres)
      await choisirAccord(v.accord)
    } finally {
      await queryClient.invalidateQueries({ queryKey: explorateurKey(moi ?? '') })
      await queryClient.invalidateQueries({ queryKey: ['preferences'] })
      // « Tous les titres » dit lesquels sont portés (zone titres, même clé).
      await queryClient.invalidateQueries({ queryKey: ['mes-titres'] })
    }
  }

  return {
    initial,
    titresDebloques: titres.data ?? [],
    erreur: explorateur.erreur || titres.isError || preferences.isError,
    reessayer: () => {
      explorateur.reessayer()
      void titres.refetch()
      void preferences.refetch()
    },
    enregistrer,
  }
}
