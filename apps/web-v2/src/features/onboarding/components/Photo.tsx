/**
 * QUOI     — « Montre-toi aux autres » : la photo de profil, juste après le nom. Le rond montre
 *            l'initiale, puis la photo choisie ; « Suivant » l'envoie, « Plus tard » passe.
 * POURQUOI — Uriel, 11/10 : encourager à mettre un avatar. Un écran à lui, pas un champ sous le
 *            nom : c'est ce qui la fait exister. Elle revient sur la bienvenue.
 * ATTENTION — l'envoi est celui de Modifier mon profil (`shared/supabase/avatar.ts`) ; un échec
 *            le dit et laisse réessayer ou passer, jamais bloqué.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import appareilPhoto from '@/assets/ui/appareil-photo.svg'
import { Avatar } from '@/shared/ui/Avatar'
import { changerAvatar, fetchEntree } from '../api/entree'
import { useParcours } from '../hooks/useParcours'
import styles from './Onboarding.module.css'
import { Page, Suivant } from './Page'

export function Photo() {
  const { aller } = useParcours()
  const queryClient = useQueryClient()
  const { data: entree } = useQuery({ queryKey: ['entree', 'moi'], queryFn: fetchEntree })
  const [photo, setPhoto] = useState<{ fichier: File; apercu: string } | null>(null)
  const envoyer = useMutation({
    mutationFn: (fichier: File) => changerAvatar(fichier),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['entree', 'moi'] })
      aller('calendrier')
    },
  })

  // L'aperçu est une adresse locale au navigateur : on la libère quand la photo change.
  useEffect(
    () => () => {
      if (photo) URL.revokeObjectURL(photo.apercu)
    },
    [photo],
  )

  return (
    <Page
      bas={
        <div className={styles.deuxChoix}>
          <button
            type="button"
            className={styles.secondaire}
            onClick={() => {
              aller('calendrier')
            }}
          >
            Plus tard
          </button>
          <Suivant
            disabled={photo === null || envoyer.isPending}
            onClick={() => {
              if (photo) envoyer.mutate(photo.fichier)
            }}
          />
        </div>
      }
    >
      <h1 className={styles.titre}>Montre-toi aux autres</h1>
      <p className={styles.chapeau}>
        Une photo de toi, de ton sac ou de ton coin préféré : c’est elle que les autres Explorateurs
        verront à côté de ton nom.
      </p>
      <div className={styles.photo}>
        <Avatar
          url={photo?.apercu ?? entree?.avatar ?? null}
          nom={entree?.nom ?? ''}
          taille="grand"
        />
        <label className={styles.choisirPhoto}>
          <img src={appareilPhoto} alt="" />
          Choisir une photo
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const fichier = e.target.files?.[0]
              if (fichier) setPhoto({ fichier, apercu: URL.createObjectURL(fichier) })
            }}
          />
        </label>
      </div>
      {envoyer.isError && (
        <p role="alert" className={styles.alerte}>
          Ta photo n’a pas pu être envoyée. Réessaie, ou passe : tu pourras la mettre depuis ton
          profil.
        </p>
      )}
    </Page>
  )
}
