/**
 * QUOI     — la feuille « Ce lieu », ouverte par le bouton rond des options (maquette 231:128).
 * POURQUOI — spec fiche §3 : « Trouver sur la carte » ; Modifier, Visibilité et Signaler arrivent
 *            avec la spec 2 — une ligne n'apparaît pas tant qu'elle ne fait rien.
 * ATTENTION — la carte est rejointe par son adresse (`/carte?centre=lat,lng`) : aucune zone
 *            n'importe l'autre.
 */
import { useNavigate } from 'react-router'
import cartePliee from '@/assets/ui/carte-pliee.svg'
import chevron from '@/assets/ui/chevron.svg'
import { Feuille } from '@/shared/ui/Feuille'
import type { FicheLieu } from '../api/lireLieu'
import styles from './Feuilles.module.css'

export function FeuilleOptions({
  fiche,
  onFermer,
}: {
  fiche: Pick<FicheLieu, 'id' | 'nom' | 'lat' | 'lng' | 'type' | 'photos'>
  onFermer: () => void
}) {
  const navigate = useNavigate()
  return (
    <Feuille titre="Ce lieu" onFermer={onFermer}>
      <h2 className={styles.titre}>Ce lieu</h2>
      <button
        type="button"
        className={styles.choix}
        onClick={() => {
          void navigate(`/carte?centre=${String(fiche.lat)},${String(fiche.lng)}`)
        }}
      >
        <img className={styles.icone} src={cartePliee} alt="" />
        <span className={styles.texte}>
          <span className={styles.nom}>Trouver sur la carte</span>
          <span className={styles.description}>Centrer la carte sur ce lieu.</span>
        </span>
        <img className={styles.chevron} src={chevron} alt="" />
      </button>
    </Feuille>
  )
}
