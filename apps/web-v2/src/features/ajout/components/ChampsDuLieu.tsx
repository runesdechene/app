/**
 * QUOI     — les champs d'une fiche : le nom en grand, les natures (trois au plus, numérotées dans
 *            l'ordre du choix, la première donne sa couleur au lieu), l'époque ou « je ne sais
 *            pas », l'année sur demande.
 * POURQUOI — les mêmes à l'ajout (étape « Nom ») et à la modification d'une fiche : un seul
 *            composant, pour que les deux écrans ne divergent jamais. Une nature porte sa bille —
 *            son icône, puis son rang dès qu'on la choisit.
 */
import { useState } from 'react'
import { BilleType } from '@/shared/ui/BilleType'
import { useEpoques, useNatures } from '../hooks/useAjout'
import styles from './EtapeNom.module.css'

const MAX_NATURES = 3
const NON_CONCERNE = 'not-applicable' // l'époque des lieux sans époque (migration 395)

export type Champs = { nom: string; natures: string[]; epoque: string | null; annee: number | null }

export function ChampsDuLieu({
  valeur,
  changer,
}: {
  valeur: Champs
  changer: (partiel: Partial<Champs>) => void
}) {
  const natures = useNatures()
  const epoques = useEpoques()
  const [anneeOuverte, setAnneeOuverte] = useState(valeur.annee !== null)
  const choisies = valeur.natures

  // Une nature sans époque en tête (une source, un spot de van) coche « Non concerné », si aucune
  // époque n'est choisie ; une nature historique repasse en tête : on le retire. Une époque
  // choisie à la main n'est jamais touchée (Uriel, 30/09).
  const basculer = (id: string) => {
    const suivantes = choisies.includes(id) ? choisies.filter((n) => n !== id) : [...choisies, id]
    const horsEpoque = natures.find((n) => n.id === suivantes[0])?.horsEpoque === true
    const epoque =
      horsEpoque && valeur.epoque === null
        ? NON_CONCERNE
        : !horsEpoque && valeur.epoque === NON_CONCERNE
          ? null
          : valeur.epoque
    changer({ natures: suivantes, epoque })
  }

  const annee = valeur.annee
  const avantJC = annee !== null && annee < 0
  const changerAnnee = (texte: string, avant: boolean) => {
    const n = Number.parseInt(texte, 10)
    // Les bornes de la base : 10 000 av. J.-C., 2100 après.
    const borne = Math.min(n, avant ? 10000 : 2100)
    changer({ annee: Number.isFinite(n) && n > 0 ? (avant ? -borne : borne) : null })
  }

  return (
    <>
      <label className={styles.etiquette} htmlFor="nom-du-lieu">
        Son nom
      </label>
      <input
        id="nom-du-lieu"
        className={styles.champNom}
        value={valeur.nom}
        maxLength={120}
        autoComplete="off"
        placeholder="Château de…"
        onChange={(e) => {
          changer({ nom: e.target.value })
        }}
      />
      <p className={styles.aide}>
        Le nom qu’on lit sur place, ou celui qu’on lui donne dans le pays. S’il n’en a pas, à toi de
        lui en donner un.
      </p>

      <h2 className={styles.etiquette}>Sa nature</h2>
      <p className={styles.aide}>Jusqu’à trois — la première donne sa couleur au lieu</p>
      <div className={styles.puces}>
        {natures.map((n) => {
          const rang = choisies.indexOf(n.id) + 1
          return (
            <button
              key={n.id}
              type="button"
              className={styles.puce}
              aria-pressed={rang > 0}
              disabled={rang === 0 && choisies.length >= MAX_NATURES}
              style={n.couleur ? { '--type': n.couleur } : undefined}
              onClick={() => {
                basculer(n.id)
              }}
            >
              {/* Sa bille : son icône ; une fois choisie, son rang. */}
              {rang > 0 ? (
                <span className={styles.bille} aria-hidden="true">
                  {rang}
                </span>
              ) : (
                n.icone && <BilleType icone={n.icone} couleur={n.couleur} />
              )}
              {n.nom}
            </button>
          )
        })}
      </div>

      <h2 className={styles.etiquette}>Son époque</h2>
      <div className={styles.puces}>
        {epoques.map((e) => (
          <button
            key={e.id}
            type="button"
            className={styles.epoque}
            aria-pressed={valeur.epoque === e.id}
            onClick={() => {
              changer({ epoque: e.id })
            }}
          >
            {e.nom}
          </button>
        ))}
        <button
          type="button"
          className={styles.epoque}
          aria-pressed={valeur.epoque === null}
          onClick={() => {
            changer({ epoque: null })
          }}
        >
          Je ne sais pas
        </button>
      </div>

      {anneeOuverte ? (
        <div className={styles.annee}>
          <label className={styles.aide} htmlFor="annee-du-lieu">
            Année
          </label>
          <input
            id="annee-du-lieu"
            className={styles.champAnnee}
            type="number"
            inputMode="numeric"
            min={1}
            max={2100}
            value={annee === null ? '' : String(Math.abs(annee))}
            onChange={(e) => {
              changerAnnee(e.target.value, avantJC)
            }}
          />
          <label className={styles.avant}>
            <input
              type="checkbox"
              checked={avantJC}
              onChange={(e) => {
                changerAnnee(annee === null ? '' : String(Math.abs(annee)), e.target.checked)
              }}
            />
            av. è. c.
          </label>
        </div>
      ) : (
        <button
          type="button"
          className={styles.preciser}
          onClick={() => {
            setAnneeOuverte(true)
          }}
        >
          ＋ Préciser l’année (1142, 52 av. è. c.…)
        </button>
      )}
    </>
  )
}
