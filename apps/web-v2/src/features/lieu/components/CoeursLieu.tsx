/**
 * QUOI     — les cœurs d'un lieu sous les crédits (maquette Figma « Lieu — aimer » B, 30/09) :
 *            « Féliciter Luna et Mathéo », puis la rangée de ceux qui ont envoyé des cœurs (elle
 *            ouvre la liste). La pastille ♥ du haut de la fiche est commune (`shared/ui`).
 * POURQUOI — Uriel, 30/09 : aimer un lieu félicite ceux qui l'ont fait, « addictif comme pour
 *            les Activités » : chaque toucher envoie un cœur qui s'envole. Sur son propre lieu,
 *            on lit ses cœurs sans pouvoir s'en envoyer.
 */
import { Avatar } from '@/shared/ui/Avatar'
import { useEnvols } from '@/shared/hooks/useEnvols'
import { Envols } from '@/shared/ui/Envols'
import type { Coeurs } from '@/shared/lib/carnet'
import { libelleFeliciter, phraseDesCoeurs } from '../lib/coeurs'
import styles from './CoeursLieu.module.css'

type Proprietes = {
  coeurs: Coeurs
  peutAimer: boolean
  onAimer: () => void
  onVoir: () => void
}

export function CoeursDesAuteurs({
  coeurs,
  peutAimer,
  onAimer,
  onVoir,
  auteurs,
}: Proprietes & { auteurs: string[] }) {
  const { envols, lancer, finir } = useEnvols()
  const tete = coeurs.gens.slice(0, 3)
  return (
    <div className={styles.auteurs}>
      {peutAimer && (
        <button
          type="button"
          className={styles.feliciter}
          aria-pressed={coeurs.miens > 0}
          onClick={() => {
            onAimer()
            lancer()
          }}
        >
          <span className={styles.coeur} aria-hidden="true" />
          <span className={styles.libelle}>{libelleFeliciter(auteurs)}</span>
          {coeurs.total > 0 && coeurs.total}
          <Envols envols={envols} onFin={finir} />
        </button>
      )}
      {tete.length > 0 && (
        <button type="button" className={styles.qui} onClick={onVoir}>
          <span className={styles.visages}>
            {tete.map((p) => (
              <Avatar key={p.id} url={p.avatar} nom={p.nom} taille="mini" />
            ))}
          </span>
          <span>{phraseDesCoeurs(coeurs.gens, coeurs.total)}</span>
          <span aria-hidden="true">›</span>
        </button>
      )}
    </div>
  )
}
