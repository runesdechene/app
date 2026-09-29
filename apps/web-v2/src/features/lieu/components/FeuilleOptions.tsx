/**
 * QUOI     — la feuille « Ce lieu », ouverte par le bouton rond des options (maquette 231:128).
 * POURQUOI — spec fiche §3 : « Trouver sur la carte ». Faire vivre un lieu (30/09, mig 387) :
 *            « Modifier la fiche » (qui l'a découvert), « L'histoire de la fiche », « Signaler ».
 *            « Supprimer ce lieu » : pour l'auteur et les admins, après une confirmation.
 *            Visibilité (l'auteur) viendra plus tard — une ligne n'apparaît pas tant qu'elle ne
 *            fait rien.
 * ATTENTION — la carte est rejointe par son adresse (`/carte/lieu/<id>?centre=lat,lng`) : la fiche
 *            reste ouverte, la carte vole jusqu'au lieu à côté ; aucune zone n'importe l'autre.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router'
import cartePliee from '@/assets/ui/carte-pliee.svg'
import chevron from '@/assets/ui/chevron.svg'
import corbeille from '@/assets/ui/corbeille.svg'
import drapeau from '@/assets/ui/drapeau.svg'
import plume from '@/assets/ui/plume.svg'
import sablier from '@/assets/ui/sablier.svg'
import { Button } from '@/shared/ui/Button'
import { Feuille } from '@/shared/ui/Feuille'
import type { FicheLieu } from '../api/lireLieu'
import { useSupprimer } from '../hooks/useSupprimer'
import styles from './Feuilles.module.css'

export function FeuilleOptions({
  fiche,
  onFermer,
  onSupprime,
  onHistoire,
  onSignaler,
}: {
  fiche: Pick<FicheLieu, 'id' | 'slug' | 'nom' | 'lat' | 'lng' | 'type' | 'photos' | 'auteur'>
  onFermer: () => void
  onSupprime: () => void
  onHistoire: () => void
  onSignaler: () => void
}) {
  const navigate = useNavigate()
  const { peut, supprimer, enCours, echec } = useSupprimer(fiche.id, fiche.auteur?.id ?? null)
  const [confirmer, setConfirmer] = useState(false)

  if (confirmer) {
    return (
      <Feuille titre="Supprimer ce lieu" onFermer={onFermer}>
        <h2 className={styles.titre}>Supprimer « {fiche.nom} » ?</h2>
        <p className={styles.avertissement}>
          C’est définitif : le lieu quitte la carte, avec ses visites et ses découvertes.
        </p>
        {echec && (
          <p className={styles.refus} role="alert">
            Le lieu n’a pas pu être supprimé. Réessaie dans un instant.
          </p>
        )}
        <div className={styles.gestes}>
          <Button
            disabled={enCours}
            onClick={() => {
              supprimer(undefined, { onSuccess: onSupprime })
            }}
          >
            {enCours ? 'Suppression…' : 'Supprimer définitivement'}
          </Button>
          <Button
            kind="discret"
            onClick={() => {
              setConfirmer(false)
            }}
          >
            Garder le lieu
          </Button>
        </div>
      </Feuille>
    )
  }

  return (
    <Feuille titre="Ce lieu" onFermer={onFermer}>
      <h2 className={styles.titre}>Ce lieu</h2>
      <Choix
        icone={cartePliee}
        nom="Trouver sur la carte"
        description="Centrer la carte sur ce lieu."
        onClick={() => {
          void navigate(`/carte/lieu/${fiche.id}?centre=${String(fiche.lat)},${String(fiche.lng)}`)
          onFermer()
        }}
      />
      <Choix
        icone={plume}
        nom="Modifier la fiche"
        description="Corriger ou enrichir : le nom, la nature, l’époque, le récit. Chaque version est gardée."
        onClick={() => {
          void navigate('modifier', { relative: 'path' })
          onFermer()
        }}
      />
      <Choix
        icone={sablier}
        nom="L’histoire de la fiche"
        description="Qui l’a écrite, version après version. On peut revenir en arrière."
        onClick={onHistoire}
      />
      <Choix
        icone={drapeau}
        nom="Signaler ce lieu"
        description="Il n’existe pas, c’est un doublon, il pose problème : l’équipe regarde."
        onClick={onSignaler}
      />
      {peut && (
        <Choix
          icone={corbeille}
          nom="Supprimer ce lieu"
          description="Réservé à qui l’a ajouté, et aux admins."
          onClick={() => {
            setConfirmer(true)
          }}
        />
      )}
    </Feuille>
  )
}

function Choix({
  icone,
  nom,
  description,
  onClick,
}: {
  icone: string
  nom: string
  description: string
  onClick: () => void
}) {
  return (
    <button type="button" className={styles.choix} onClick={onClick}>
      <img className={styles.icone} src={icone} alt="" />
      <span className={styles.texte}>
        <span className={styles.nom}>{nom}</span>
        <span className={styles.description}>{description}</span>
      </span>
      <img className={styles.chevron} src={chevron} alt="" />
    </button>
  )
}
