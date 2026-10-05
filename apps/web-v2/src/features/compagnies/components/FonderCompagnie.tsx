/**
 * QUOI     — fonder une Compagnie (maquette 396:326) : la fiche, puis « Fonder la Compagnie », qui
 *            ouvre sa fiche. Les rôles se renomment ensuite dans « Gérer ».
 * POURQUOI — réservé aux Porteurs (EcranFonder choisit l'écran) ; la base refuse aussi, avec un
 *            indice (`porteur`, `nom_pris`).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { canauxKey } from '@/shared/lib/cles'
import { Button } from '@/shared/ui/Button'
import { fonder } from '../api/compagnies'
import type { ChampsFiche } from '../api/lireCompagnies'
import { compagniesKey } from '../hooks/useCompagnies'
import { messageDeRefus } from '../lib/refus'
import { ChampsCompagnie, PALETTE } from './ChampsCompagnie'
import styles from './GererCompagnie.module.css'

const VIDE: ChampsFiche = {
  nom: '',
  devise: '',
  mission: '',
  couleur: PALETTE[0] ?? '#5f6f86',
  avatar: null,
  privee: false,
}

export function FonderCompagnie() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [valeur, setValeur] = useState(VIDE)
  const fondation = useMutation({
    mutationFn: () =>
      fonder({
        ...valeur,
        nom: valeur.nom.trim(),
        devise: valeur.devise.trim(),
        mission: valeur.mission.trim(),
      }),
    onSuccess: (id) => {
      void queryClient.invalidateQueries({ queryKey: compagniesKey })
      void queryClient.invalidateQueries({ queryKey: canauxKey })
      void navigate(`../../compagnie/${id}`, { relative: 'path' })
    },
  })

  return (
    <div className={styles.ecran}>
      <h2 className={styles.titre}>Fonder une Compagnie</h2>
      <ChampsCompagnie
        valeur={valeur}
        changer={(partiel) => {
          setValeur((avant) => ({ ...avant, ...partiel }))
        }}
      />
      {fondation.isError && (
        <p className={styles.refus} role="alert">
          {messageDeRefus(fondation.error)}
        </p>
      )}
      <Button
        disabled={valeur.nom.trim().length < 2 || fondation.isPending}
        onClick={() => {
          fondation.mutate()
        }}
      >
        {fondation.isPending ? 'Fondation…' : 'Fonder la Compagnie'}
      </Button>
      <p className={styles.aide}>
        Le canal s’ouvre dans La Communauté, et tu deviens Chef. Les rôles se renomment ensuite dans
        « Gérer ».
      </p>
    </div>
  )
}
