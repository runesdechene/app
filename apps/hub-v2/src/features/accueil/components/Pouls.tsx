/**
 * QUOI     — les six chiffres du pouls (définitions : spec §8).
 * ATTENTION — « Actifs » n'a pas d'écart : last_login_at ne garde que la dernière connexion.
 */
import { ecart } from '@/shared/lib/ecart'
import { Tuile } from '@/shared/ui/Tuile'
import type { Compteurs, Ouverture } from '../api/ouverture'
import styles from './Ouverture.module.css'

const TUILES: { cle: keyof Ouverture['pouls']; libelle: string }[] = [
  { cle: 'nouveaux', libelle: 'Nouveaux comptes' },
  { cle: 'reactives', libelle: 'Comptes réactivés' },
  { cle: 'actifs', libelle: 'Actifs' },
  { cle: 'lieux', libelle: 'Lieux ajoutés' },
  { cle: 'visites', libelle: 'Visites sur place' },
  { cle: 'enigmes', libelle: 'Énigmes percées' },
]

const nombre = new Intl.NumberFormat('fr-FR')

export function Pouls({ pouls, avant }: { pouls: Ouverture['pouls']; avant: Compteurs }) {
  return (
    <div className={styles.tuiles}>
      {TUILES.map(({ cle, libelle }) => {
        const e = cle === 'actifs' ? undefined : ecart(pouls[cle], avant[cle])
        return <Tuile key={cle} libelle={libelle} valeur={nombre.format(pouls[cle])} {...(e ? { ecart: e } : {})} />
      })}
    </div>
  )
}
