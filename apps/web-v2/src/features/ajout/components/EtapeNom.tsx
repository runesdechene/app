/**
 * QUOI     — l'étape « Son nom, sa nature, son époque » (maquette 291:146) : la photo en tête, déjà
 *            séparée du parchemin par la lisière comme sur la fiche ; le nom en grand ; les natures
 *            (trois au plus, numérotées dans l'ordre du choix, la première donne sa couleur au
 *            lieu) ; l'époque, ou « je ne sais pas » ; l'année sur demande.
 * POURQUOI — la fiche prend forme : le nom s'écrit comme le titre qu'il deviendra. Une nature
 *            porte sa bille (sa couleur et son rang) dès qu'on la choisit. Rien n'est obligatoire
 *            hors le nom et une nature : l'époque et l'année aident, sans bloquer.
 */
import { useState } from 'react'
import { useEpoques, useNatures } from '../hooks/useAjout'
import { useUrlDe } from '../hooks/useUrlDe'
import { ceQuiManque, type ProprietesEtape } from '../lib/brouillon'
import { BoutonSuivant } from './BoutonSuivant'
import styles from './EtapeNom.module.css'

const MAX_NATURES = 3

export function EtapeNom({ brouillon, changer, onSuivant }: ProprietesEtape) {
  const natures = useNatures()
  const epoques = useEpoques()
  const photo = useUrlDe(brouillon.photos[0]?.grande)
  const [anneeOuverte, setAnneeOuverte] = useState(brouillon.annee !== null)
  const choisies = brouillon.natures

  const basculer = (id: string) => {
    changer({
      natures: choisies.includes(id) ? choisies.filter((n) => n !== id) : [...choisies, id],
    })
  }

  const annee = brouillon.annee
  const avantJC = annee !== null && annee < 0
  const changerAnnee = (valeur: string, avant: boolean) => {
    const n = Number.parseInt(valeur, 10)
    // Les bornes de la base : 10 000 av. J.-C., 2100 après.
    const borne = Math.min(n, avant ? 10000 : 2100)
    changer({ annee: Number.isFinite(n) && n > 0 ? (avant ? -borne : borne) : null })
  }

  return (
    <div className={styles.nom}>
      <div className={styles.photo}>{photo && <img src={photo} alt="" />}</div>

      <div className={styles.corps}>
        <label className={styles.etiquette} htmlFor="nom-du-lieu">
          Son nom
        </label>
        <input
          id="nom-du-lieu"
          className={styles.champNom}
          value={brouillon.nom}
          maxLength={120}
          autoComplete="off"
          placeholder="Château de…"
          onChange={(e) => {
            changer({ nom: e.target.value })
          }}
        />
        <p className={styles.aide}>
          Le nom qu’on lit sur place, ou celui qu’on lui donne dans le pays. S’il n’en a pas, à toi
          de lui en donner un.
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
                {rang > 0 && (
                  <span className={styles.bille} aria-hidden="true">
                    {rang}
                  </span>
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
              aria-pressed={brouillon.epoque === e.id}
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
            aria-pressed={brouillon.epoque === null}
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
              av. J.-C.
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
            ＋ Préciser l’année (1142, 52 av. J.-C.…)
          </button>
        )}
      </div>

      <BoutonSuivant
        libelle="Continuer"
        manque={ceQuiManque(brouillon, 'nom')}
        onClick={onSuivant}
      />
    </div>
  )
}
