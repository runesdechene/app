/**
 * QUOI     — le geste « Découvrir » (maquettes 250:128, 250:134, 250:140) : un lieu inconnu
 *            s'ouvre voilé — sa photo floutée sous un parchemin — ; le doigt déchire le voile,
 *            passé la moitié le reste s'arrache, un tintement, puis la récompense. Sous la
 *            consigne, le prix (maquettes « Énergie — 2 à 4 », 01/10) : gratuit dans la zone
 *            gratuite (50 km, réglée dans le Hub), sinon des points d'énergie ; quand
 *            la jauge ne suffit pas, le geste se ferme.
 * POURQUOI — Uriel, 28/09 : « un truc classe et addictif ». Pas de bouton au centre : le geste
 *            suffit ; « Découvrir », discret en bas, arrache tout d'un coup pour qui ne gratte pas.
 *            La découverte part à la base dès que l'arrachage commence : elle arrive pendant
 *            l'animation, la récompense n'attend pas. Si la base refuse (jauge trop basse, réseau),
 *            une nouvelle tentative commence avec un voile neuf, repeint : le lieu reste caché.
 * ATTENTION — animations réduites : le voile disparaît sans s'envoler (aucune fin d'animation
 *            n'arriverait).
 */
import { aLaTaille } from '@/shared/lib/image'
import { useEffect, useState } from 'react'
import { useMaPosition } from '@/shared/hooks/useMaPosition'
import { attente } from '@/shared/lib/attente'
import type { CoutDecouverte, FicheLieu } from '../api/lireLieu'
import { useCoutDecouverte } from '../hooks/useCoutDecouverte'
import { useDecouvrir } from '../hooks/useDecouvrir'
import { useGrattage } from '../hooks/useGrattage'
import { tinter } from '../lib/tintement'
import styles from './DecouverteLieu.module.css'
import { Recompense } from '@/shared/ui/Recompense'

const mouvementReduit = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const KM = new Intl.NumberFormat('fr-FR')

function phraseRang(rang: number) {
  return rang === 1 ? 'Ton 1ᵉʳ lieu découvert !' : `Ton ${String(rang)}ᵉ lieu découvert !`
}

const points = (n: number) => `${String(n)} point${n > 1 ? 's' : ''}`

// Le temps avant d'avoir assez de points : ceux qui manquent, le premier revenant au plus tôt.
function avantAssez(c: CoutDecouverte) {
  return (c.cout - c.points - 1) * c.parPoint + (c.prochainDans ?? c.parPoint)
}

type Props = { fiche: Pick<FicheLieu, 'id' | 'nom' | 'photos' | 'type'>; onFermer: () => void }

// Chaque tentative a son voile : une tentative refusée laisse place à la suivante, voile neuf.
export function DecouverteLieu(props: Props) {
  const [tentative, setTentative] = useState(0)
  return (
    <Tentative
      key={tentative}
      {...props}
      refusee={tentative > 0}
      onRefus={() => {
        setTentative((n) => n + 1)
      }}
    />
  )
}

function Tentative({
  fiche,
  onFermer,
  refusee,
  onRefus,
}: Props & { refusee: boolean; onRefus: () => void }) {
  const position = useMaPosition()
  const { cout, utiliserMaPosition } = useCoutDecouverte(fiche.id, position)
  const { decouvrir, recompense, acceder } = useDecouvrir(fiche.id, position, onRefus)
  const [lance, setLance] = useState(false) // l'arrachage a commencé
  const [arrache, setArrache] = useState(false) // le voile est parti
  // Plein écran : à la largeur de l'écran (le voile, lui, la réduit à 24 px — useGrattage).
  const photo = aLaTaille(fiche.photos[0]?.url ?? null, Math.min(window.innerWidth, 1000))
  // Tant que le prix n'est pas lu, le geste reste ouvert : la base aura le dernier mot.
  const assez = !cout || cout.points >= cout.cout

  const lancer = () => {
    if (lance || !assez) return
    setLance(true)
    decouvrir()
    if (mouvementReduit()) setArrache(true)
  }
  const { canevas, gratte, gratter, lever } = useGrattage(
    aLaTaille(fiche.photos[0]?.url ?? null, 24),
    lancer,
  )
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
          onPointerMove={assez ? gratter : undefined}
          onPointerLeave={lever}
          onPointerUp={lever}
          onAnimationEnd={() => {
            setArrache(true)
          }}
        />
      )}

      {!lance && (
        <>
          <div
            className={gratte && assez ? styles.consigneEffacee : styles.consigne}
            data-terne={!assez || undefined}
          >
            <h2 className={styles.inconnu}>Un lieu inconnu</h2>
            <span className={styles.sceau} aria-hidden="true">
              ?
            </span>
            {cout && !assez ? (
              <p className={styles.phrase}>
                Reviens dans {attente(avantAssez(cout))} pour le révéler
              </p>
            ) : (
              <p className={styles.phrase}>
                <span className={styles.auDoigt}>Passe ton doigt pour révéler le lieu</span>
                <span className={styles.aLaSouris}>Passe ta souris pour révéler le lieu</span>
              </p>
            )}
            <Prix cout={cout} onPosition={utiliserMaPosition} />
          </div>
          <button type="button" className={styles.decouvrir} onClick={lancer} disabled={!assez}>
            Découvrir
          </button>
        </>
      )}

      {refusee && !lance && assez && (
        <div role="alert" className={styles.echec}>
          La découverte n’a pas pu être enregistrée.
          <button type="button" className={styles.reessayer} onClick={lancer}>
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

// Le prix, sous la consigne : « … » tant que la base n'a pas répondu.
function Prix({
  cout: c,
  onPosition,
}: {
  cout: CoutDecouverte | undefined
  onPosition: () => void
}) {
  if (!c) {
    return (
      <span className={styles.prix} aria-busy="true">
        …
      </span>
    )
  }
  if (c.cout === 0) {
    return (
      <span className={styles.prix}>
        <strong>Gratuit</strong>
        <span>· à {KM.format(c.distanceKm ?? 0)} km de toi</span>
      </span>
    )
  }
  const assez = c.points >= c.cout
  const ou = c.distanceKm === null ? null : `· à ${KM.format(c.distanceKm)} km`
  return (
    <>
      <span className={styles.prix}>
        <span className={styles.eclair} aria-hidden="true" />
        {assez ? (
          <>
            <strong>{points(c.cout)} d’énergie</strong>
            {ou && <span>{ou}</span>}
          </>
        ) : (
          <>
            <strong>Il te faut {points(c.cout)}</strong>
            <span>· il t’en reste {c.points}</span>
          </>
        )}
      </span>
      <span className={styles.precision}>
        {assez
          ? `Il t’en restera ${String(c.points - c.cout)} sur ${String(c.max)}`
          : `Le prochain point revient dans ${attente(c.prochainDans ?? c.parPoint)}. Les lieux à moins de ${KM.format(c.gratuitKm)} km restent gratuits.`}
      </span>
      {c.distanceKm === null && (
        <button type="button" className={styles.maPosition} onClick={onPosition}>
          Utiliser ma position
        </button>
      )}
    </>
  )
}
