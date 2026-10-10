/**
 * QUOI     — la frise des époques, en bande sur la carte (maquette Figma 539:851 PC, 542:878
 *            téléphone) : la plage en clair, une case par époque datée, deux poignées et leurs
 *            bornes dans le calendrier du joueur, et la date du jour sous le détail.
 * POURQUOI — spec 2026-10-10-frise-des-epoques : elle remplace les boutons « Époques » de la
 *            feuille des filtres. Deux `<input type="range">` natifs : le clavier et les lecteurs
 *            d'écran sans bibliothèque.
 * ATTENTION — une poignée s'arrête sur l'autre ; la plage n'est jamais inversée. Le CSS place
 *            chaque slider pour que sa poignée tombe au bord d'une case (voir le module CSS).
 */
import { dateEnClair } from '@runes/calendrier'
import { useCalendrier } from '@/shared/hooks/useCalendrier'
import type { EpoqueFiltre } from '../api/lireCarte'
import {
  auRepos,
  bornes,
  enTete,
  ensembleDe,
  epoquesDatees,
  plageDe,
  type Plage,
} from '../lib/frise'
import styles from './FriseDesEpoques.module.css'

type Props = {
  epoques: EpoqueFiltre[]
  choix: ReadonlySet<string>
  onChoix: (choix: ReadonlySet<string>) => void
}

export function FriseDesEpoques({ epoques, choix, onChoix }: Props) {
  const calendrier = useCalendrier()
  const frise = epoquesDatees(epoques)
  if (frise.length < 2) return null
  const plage = plageDe(frise, choix)
  const repos = auRepos(frise, plage)
  const { titre, detail } = enTete(frise, plage, calendrier)
  const { debut, fin } = bornes(frise, plage, calendrier)
  const dernier = frise.length - 1
  const choisir = (p: Plage) => {
    onChoix(ensembleDe(frise, p))
  }

  return (
    <section className={styles.bande} aria-label="La frise des époques">
      <div className={styles.tete}>
        <div>
          <p className={styles.titre}>{titre}</p>
          <p className={styles.detail}>{detail}</p>
          <p className={styles.aujourdhui}>{`Aujourd'hui · ${dateEnClair(new Date(), calendrier)}`}</p>
        </div>
        {!repos && (
          <button
            type="button"
            className={styles.tout}
            onClick={() => {
              onChoix(new Set())
            }}
          >
            Tout
          </button>
        )}
      </div>
      <div
        className={styles.piste}
        style={{ '--n': String(frise.length), '--de': String(plage.de), '--a': String(plage.a) }}
      >
        <ol className={styles.cases}>
          {frise.map((e, i) => (
            <li
              key={e.id}
              className={styles.case}
              data-dedans={(!repos && i >= plage.de && i <= plage.a) || undefined}
            >
              <span className={styles.nom}>{e.nom}</span>
            </li>
          ))}
        </ol>
        <input
          type="range"
          className={styles.debut}
          min={0}
          max={dernier}
          step={1}
          value={plage.de}
          aria-label="Début de la plage"
          aria-valuetext={frise[plage.de]?.nom}
          onChange={(ev) => {
            choisir({ de: Math.min(Number(ev.target.value), plage.a), a: plage.a })
          }}
        />
        <input
          type="range"
          className={styles.fin}
          min={0}
          max={dernier}
          step={1}
          value={plage.a}
          aria-label="Fin de la plage"
          aria-valuetext={frise[plage.a]?.nom}
          onChange={(ev) => {
            choisir({ de: plage.de, a: Math.max(Number(ev.target.value), plage.de) })
          }}
        />
        <p
          className={styles.bornes}
          data-seule={plage.de === plage.a || undefined}
          aria-hidden="true"
        >
          {repos ? (
            <>
              <span className={styles.bout}>{frise[0]?.nom}</span>
              <span className={styles.boutFin}>{frise[dernier]?.nom}</span>
            </>
          ) : (
            <>
              {debut !== null && (
                <span
                  className={styles.annee}
                  data-cote="debut"
                  data-bord={plage.de === 0 || undefined}
                >
                  {debut}
                </span>
              )}
              {fin !== null && (
                <span
                  className={styles.annee}
                  data-cote="fin"
                  data-bord={plage.a === dernier || undefined}
                >
                  {fin}
                </span>
              )}
            </>
          )}
        </p>
      </div>
    </section>
  )
}
