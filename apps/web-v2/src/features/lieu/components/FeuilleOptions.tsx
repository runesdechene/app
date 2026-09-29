/**
 * QUOI     — la feuille « Ce lieu », ouverte par le bouton rond des options (maquette 231:128).
 * POURQUOI — spec fiche §3 : « Trouver sur la carte » ; Modifier, Visibilité et Signaler arrivent
 *            avec la spec 2 — une ligne n'apparaît pas tant qu'elle ne fait rien. « Supprimer ce
 *            lieu » (Uriel, 30/09) : pour l'auteur et les admins, après une confirmation.
 * ATTENTION — la carte est rejointe par son adresse (`/carte/lieu/<id>?centre=lat,lng`) : la fiche
 *            reste ouverte, la carte vole jusqu'au lieu à côté ; aucune zone n'importe l'autre.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router'
import cartePliee from '@/assets/ui/carte-pliee.svg'
import chevron from '@/assets/ui/chevron.svg'
import corbeille from '@/assets/ui/corbeille.svg'
import { Button } from '@/shared/ui/Button'
import { Feuille } from '@/shared/ui/Feuille'
import type { FicheLieu } from '../api/lireLieu'
import { useSupprimer } from '../hooks/useSupprimer'
import styles from './Feuilles.module.css'

export function FeuilleOptions({
  fiche,
  onFermer,
  onSupprime,
}: {
  fiche: Pick<FicheLieu, 'id' | 'slug' | 'nom' | 'lat' | 'lng' | 'type' | 'photos' | 'auteur'>
  onFermer: () => void
  onSupprime: () => void
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
      <button
        type="button"
        className={styles.choix}
        onClick={() => {
          void navigate(`/carte/lieu/${fiche.id}?centre=${String(fiche.lat)},${String(fiche.lng)}`)
          onFermer()
        }}
      >
        <img className={styles.icone} src={cartePliee} alt="" />
        <span className={styles.texte}>
          <span className={styles.nom}>Trouver sur la carte</span>
          <span className={styles.description}>Centrer la carte sur ce lieu.</span>
        </span>
        <img className={styles.chevron} src={chevron} alt="" />
      </button>
      {peut && (
        <button
          type="button"
          className={styles.choix}
          onClick={() => {
            setConfirmer(true)
          }}
        >
          <img className={styles.icone} src={corbeille} alt="" />
          <span className={styles.texte}>
            <span className={styles.nom}>Supprimer ce lieu</span>
            <span className={styles.description}>Réservé à qui l’a ajouté, et aux admins.</span>
          </span>
          <img className={styles.chevron} src={chevron} alt="" />
        </button>
      )}
    </Feuille>
  )
}
