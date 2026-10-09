/**
 * QUOI     — la bienvenue (maquette 95:107) : le voyageur, « Bienvenue Claire », son numéro
 *            d'Explorateur, une promesse, puis « Ouvrir la carte ».
 * POURQUOI — le numéro est le rang de l'inscription (mon_entree, migration 370) : vrai, jamais
 *            inventé. « Voir mes Fragments » n'apparaît que s'il y en a. Venu d'un lieu de la
 *            vitrine, « Ouvrir la carte » ouvre ce lieu.
 */
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import voyageur from '@/assets/onboarding/voyageur.webp'
import { reprendreLieu } from '@/shared/lib/apresEntree'
import { fetchEntree } from '../api/entree'
import { enLettres } from '../lib/enLettres'
import styles from './Onboarding.module.css'
import { Page } from './Page'

const NOMBRE = new Intl.NumberFormat('fr-FR')

export function Bienvenue() {
  const navigate = useNavigate()
  const { data: entree } = useQuery({ queryKey: ['entree', 'moi'], queryFn: fetchEntree })
  const fragments = entree?.fragments ?? 0

  return (
    <Page
      bas={
        <>
          <button
            type="button"
            className={styles.principal}
            onClick={() => {
              const lieu = reprendreLieu()
              void navigate(lieu ? `/carte/lieu/${lieu}` : '/carte', { replace: true })
            }}
          >
            Ouvrir la carte
          </button>
          {fragments > 0 && (
            <button
              type="button"
              className={styles.secondaire}
              onClick={() => {
                void navigate('/compte', { replace: true })
              }}
            >
              {fragments > 1 ? `Voir mes ${enLettres(fragments)} Fragments` : 'Voir mon Fragment'}
            </button>
          )}
        </>
      }
    >
      <div className={styles.bienvenue}>
        <img className={styles.voyageur} src={voyageur} alt="" />
        <h1 className={styles.salut}>
          <span className={styles.salutMot}>Bienvenue</span>
          <span className={styles.salutNom}>{entree?.nom ?? ''}</span>
        </h1>
        {entree && (
          <p className={styles.numero}>
            Explorateur n° <span className={styles.souligne}>{NOMBRE.format(entree.numero)}</span>
          </p>
        )}
        <p className={styles.promesse}>
          Quelque part près de chez toi, un lieu oublié attend qu’on se souvienne de lui, et un
          compagnon surgit de l’ombre pour te soutenir. Dans le souffle du vent, on perçoit déjà tes
          aventures futures…
        </p>
      </div>
    </Page>
  )
}
