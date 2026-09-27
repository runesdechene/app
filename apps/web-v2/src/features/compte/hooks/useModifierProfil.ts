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
  enregistrer: (valeurs: ValeursProfil, photo: File | null) => Promise<void>
} {
  const moi = useMonIdentifiant()
  const queryClient = useQueryClient()
  const { profil } = useExplorateur(moi)
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

  async function enregistrer(v: ValeursProfil, photo: File | null) {
    await enregistrerProfil({ nom: v.nom, bio: v.bio, instagram: v.instagram })
    if (photo) await changerAvatar(photo)
    await choisirTitres(v.titres)
    await choisirAccord(v.accord)
    await queryClient.invalidateQueries({ queryKey: explorateurKey(moi ?? '') })
    await queryClient.invalidateQueries({ queryKey: ['preferences'] })
  }

  return { initial, titresDebloques: titres.data ?? [], enregistrer }
}
