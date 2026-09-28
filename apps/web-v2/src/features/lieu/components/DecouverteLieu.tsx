/**
 * QUOI     — le geste « Découvrir » (maquettes 250:128, 250:134, 250:140) : un lieu inconnu
 *            s'ouvre voilé — sa photo floutée sous un parchemin — ; le doigt déchire le voile,
 *            passé la moitié le reste s'arrache, un tintement, puis la récompense.
 * POURQUOI — Uriel, 28/09 : « un truc classe et addictif ». Pas de bouton au centre : le geste
 *            suffit ; « Découvrir », discret en bas, arrache tout d'un coup pour qui ne gratte pas.
 *            La découverte part à la base dès que l'arrachage commence : elle arrive pendant
 *            l'animation, la récompense n'attend pas.
 * ATTENTION — animations réduites : le voile disparaît sans s'envoler (aucune fin d'animation
 *            n'arriverait).
 */
import { useEffect, useState } from 'react'
import type { FicheLieu } from '../api/lireLieu'
import { useDecouvrir } from '../hooks/useDecouvrir'
import { useGrattage } from '../hooks/useGrattage'
import { tinter } from '../lib/tintement'
import styles from './DecouverteLieu.module.css'
import { Recompense } from '@/shared/ui/Recompense'

const mouvementReduit = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function phraseRang(rang: number) {
  return rang === 1 ? 'Ton 1ᵉʳ lieu découvert !' : `Ton ${String(rang)}ᵉ lieu découvert !`
}

export function DecouverteLieu({
  fiche,
  onFermer,
}: {
  fiche: Pick<FicheLieu, 'id' | 'nom' | 'photos' | 'type'>
  onFermer: () => void
}) {
  const { decouvrir, recompense, echec, acceder } = useDecouvrir(fiche.id)
  const [lance, setLance] = useState(false) // l'arrachage a commencé
  const [arrache, setArrache] = useState(false) // le voile est parti
  const photo = fiche.photos[0]?.url ?? null

  const lancer = () => {
    if (lance) return
    setLance(true)
    decouvrir()
    if (mouvementReduit()) setArrache(true)
  }
  const { canevas, gratte, gratter, lever } = useGrattage(photo, lancer)
  const revele = arrache && recompense !== null

  useEffect(() => {
    if (revele) tinter()
  }, [revele])

  return (
    <div className={styles.decouverte}>
      {photo ? (
        <img className={styles.photo} src={photo} alt="" />
      ) : (
        <span className={styles.sansPhoto} />
      )}

      {!arrache && (
        <canvas
          ref={canevas}
          className={lance ? styles.arrache : styles.voile}
          aria-hidden="true"
          onPointerMove={gratter}
          onPointerLeave={lever}
          onPointerUp={lever}
          onAnimationEnd={() => {
            setArrache(true)
          }}
        />
      )}

      {!lance && (
        <>
          <div className={gratte ? styles.consigneEffacee : styles.consigne}>
            <h2 className={styles.inconnu}>Un lieu inconnu</h2>
            <span className={styles.sceau} aria-hidden="true">
              ?
            </span>
            <p className={styles.phrase}>
              <span className={styles.auDoigt}>Passe ton doigt pour révéler le lieu</span>
              <span className={styles.aLaSouris}>Passe ta souris pour révéler le lieu</span>
            </p>
          </div>
          <button type="button" className={styles.decouvrir} onClick={lancer}>
            Découvrir
          </button>
        </>
      )}

      {echec && (
        <div role="alert" className={styles.echec}>
          La découverte n’a pas pu être enregistrée.
          <button type="button" className={styles.reessayer} onClick={decouvrir}>
            Réessayer
          </button>
        </div>
      )}

      {revele && (
        <Recompense
          nom={fiche.nom}
          type={fiche.type?.nom ?? null}
          phrase={phraseRang(recompense.rang)}
          gain={recompense}
          libelleAcceder="Accéder au lieu"
          libelleRevenir="Revenir à la carte"
          onAcceder={acceder}
          onFermer={onFermer}
        />
      )}
    </div>
  )
}
