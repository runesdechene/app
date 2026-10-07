/**
 * QUOI     — le verdict d'une énigme, dans sa feuille : la fête en tête (un mot tiré au sort, les
 *            confettis, la bonne réponse rappelée, un titre gagné), puis le bilan (les jauges du
 *            niveau et de la connaissance qui se remplissent, « Le savais-tu ? »).
 * POURQUOI — maquettes « Énigmes — 5b, 5c, 5d » (Uriel, 07/10 : « il n'y a pas d'émotion ») : le
 *            langage de la récompense de Découvrir (confettis, tintement, jauge qui se remplit),
 *            dans la feuille, pour que l'explication reste juste dessous. Faux : rien de punitif —
 *            « Pas cette fois », un soupir doux, et « Le savais-tu ? » au premier plan.
 * ATTENTION — les sons partent à l'arrivée du verdict, juste après le toucher : le navigateur les
 *            laisse jouer. Animations réduites : rien ne bouge, tout est déjà à sa place.
 */
import { useEffect, useState } from 'react'
import { soupirer, tinter, tinterGrave } from '@/shared/lib/sons'
import { Text } from '@/shared/ui/Text'
import type { Verdict } from '../api/lireEnigmes'
import { connaissanceEnClair, motDeFete, prochainEnClair } from '../lib/enigmeEnClair'
import styles from './VerdictEnigme.module.css'

const CONFETTIS = 14
const APRES_LE_TINTEMENT = 700

export function FeteDuVerdict({ verdict }: { verdict: Verdict }) {
  const [mot] = useState(() => motDeFete(Math.random()))
  const titreGagne = verdict.nouveauxTitres.length > 0

  useEffect(() => {
    if (!verdict.juste) {
      soupirer()
      return
    }
    tinter()
    if (!titreGagne) return
    const plusTard = setTimeout(tinterGrave, APRES_LE_TINTEMENT)
    return () => {
      clearTimeout(plusTard)
    }
  }, [verdict.juste, titreGagne])

  return (
    <section className={styles.fete} data-juste={verdict.juste || undefined} aria-live="polite">
      {verdict.juste && (
        <div className={styles.confettis} aria-hidden="true">
          {Array.from({ length: CONFETTIS }, (_, i) => (
            <span key={i} style={{ '--rang': String(i) }} />
          ))}
        </div>
      )}
      <p className={styles.mot}>{verdict.juste ? mot : 'Pas cette fois'}</p>
      <p className={styles.reponse}>{`La réponse : ${verdict.reponse}`}</p>
      {verdict.nouveauxTitres.map((t) => (
        <div key={t} className={styles.titre}>
          <span className={styles.surtitre}>Nouveau titre</span>
          <span className={styles.gelule}>
            <span aria-hidden="true">✦</span> {t}
          </span>
          <Text variant="flux">{`Te voilà ${t}. Il se porte depuis ton profil.`}</Text>
        </div>
      ))}
    </section>
  )
}

export function BilanDuVerdict({ verdict, culture }: { verdict: Verdict; culture: string }) {
  const part = (points: number) => (verdict.total > 0 ? Math.min(1, points / verdict.total) : 0)
  return (
    <div className={styles.bilan}>
      {verdict.juste && (
        <div className={styles.jauges}>
          <Jauge
            nom={`Niveau ${String(verdict.niveau.niveau)}`}
            gain={`+${String(verdict.xp)} XP`}
            avant={verdict.niveau.avant}
            apres={verdict.niveau.apres}
          />
          <Jauge
            nom={culture}
            gain={`+${String(verdict.gagnes)} connaissance`}
            avant={part(verdict.points - verdict.gagnes)}
            apres={part(verdict.points)}
            culture
          />
          <Text variant="legende">{prochainEnClair(verdict, culture)}</Text>
        </div>
      )}
      <div className={styles.savais} data-faux={verdict.juste ? undefined : true}>
        <span className={styles.savaisTitre}>Le savais-tu ?</span>
        <p className={styles.explication}>{verdict.explication}</p>
      </div>
      {!verdict.juste && <Text variant="legende">{connaissanceEnClair(verdict.points, verdict.total, culture)}</Text>}
    </div>
  )
}

function Jauge({
  nom,
  gain,
  avant,
  apres,
  culture = false,
}: {
  nom: string
  gain: string
  avant: number
  apres: number
  culture?: boolean
}) {
  return (
    <div className={styles.jauge} data-culture={culture || undefined}>
      <span className={styles.ligne}>
        <span className={styles.nomJauge}>{nom}</span>
        <span className={styles.gain}>{gain}</span>
      </span>
      <span
        className={styles.piste}
        role="progressbar"
        aria-label={nom}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(apres * 100)}
      >
        <span className={styles.rempli} style={{ '--avant': String(avant), '--mesure': String(apres) }} />
      </span>
    </div>
  )
}
