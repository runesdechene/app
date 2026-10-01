/**
 * QUOI     — « Les actifs autour de toi » (maquette 363:303) : les Explorateurs en ligne ou passés
 *            dans l'heure, les plus proches d'abord ; toucher une ligne ouvre sa carte.
 * POURQUOI — le compteur promet du monde : la liste le montre, sans chercher sur la carte. Un
 *            Explorateur parti depuis peu reste, grisé, avec l'heure de son passage.
 */
import type { Point } from '@/shared/lib/distance'
import { Avatar } from '@/shared/ui/Avatar'
import { Feuille } from '@/shared/ui/Feuille'
import type { Actif } from '../api/lireActifs'
import { distanceDe, etat, parProximite } from '../lib/actifs'
import styles from './FeuilleActifs.module.css'

function qui(a: Actif): string {
  if (a.brouille) return 'Pistes brouillées'
  return [a.titre, `niv. ${String(a.niveau)}`].filter(Boolean).join(' · ')
}

export function FeuilleActifs({
  actifs,
  moi,
  onChoisir,
  onFermer,
}: {
  actifs: Actif[]
  moi: Point | null
  onChoisir: (id: string) => void
  onFermer: () => void
}) {
  return (
    <Feuille titre="Les actifs autour de toi" onFermer={onFermer}>
      <div className={styles.feuille}>
        <h2 className={styles.titre}>Les actifs autour de toi</h2>
        <p className={styles.chapo}>En ligne, ou passés dans l’heure — les plus proches d’abord</p>
        <ul className={styles.liste}>
          {parProximite(actifs, moi).map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className={styles.ligne}
                data-recent={!a.enLigne || undefined}
                onClick={() => {
                  onChoisir(a.id)
                }}
              >
                <Avatar url={a.avatar} nom={a.nom} taille="petit" />
                <span className={styles.texte}>
                  <span className={styles.nom}>{a.nom}</span>
                  <span className={styles.sous}>
                    <span className={styles.etat}>{etat(a)}</span> · {qui(a)}
                  </span>
                </span>
                <span className={styles.distance}>{distanceDe(a, moi)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Feuille>
  )
}
