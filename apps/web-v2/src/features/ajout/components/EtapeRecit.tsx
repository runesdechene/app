/**
 * QUOI     — l'étape « Récit » (maquette 291:209) : la fiche en petit (la photo, le nom, la nature),
 *            « Raconte-le », un carnet ligné où le récit s'écrit en IM Fell, et des pistes pour qui
 *            sèche — chacune glisse une amorce de phrase à la suite du texte, curseur prêt.
 * POURQUOI — écrire comme dans un carnet, pas remplir un champ. Trois lignes suffisent ; le bouton
 *            n'attend que quelques mots.
 */
import { useRef } from 'react'
import { useNatures } from '../hooks/useAjout'
import { useUrlDe } from '../hooks/useUrlDe'
import { ceQuiManque, type ProprietesEtape } from '../lib/brouillon'
import { BoutonSuivant } from './BoutonSuivant'
import styles from './EtapeRecit.module.css'

const PISTES = [
  { libelle: 'Ce qu’on y voit', amorce: 'On y voit ' },
  { libelle: 'Son histoire', amorce: 'Son histoire : ' },
  { libelle: 'Comment y accéder', amorce: 'Pour y aller, ' },
  { libelle: 'Le meilleur moment', amorce: 'Le meilleur moment, c’est ' },
  { libelle: 'Une légende', amorce: 'On raconte que ' },
] as const

const MAX_SIGNES = 5000

export function EtapeRecit({ brouillon, changer, onSuivant }: ProprietesEtape) {
  const carnet = useRef<HTMLTextAreaElement>(null)
  const photo = useUrlDe(brouillon.photos[0]?.vignette)
  const principale = useNatures().find((n) => n.id === brouillon.natures[0])
  const recit = brouillon.recit

  const glisser = (amorce: string) => {
    const suite = recit.trim() === '' ? amorce : `${recit.trimEnd()}\n\n${amorce}`
    changer({ recit: suite })
    // Le curseur se pose au bout de l'amorce, dans le carnet qui reprend la main.
    requestAnimationFrame(() => {
      const c = carnet.current
      if (!c) return
      c.focus()
      c.setSelectionRange(suite.length, suite.length)
    })
  }

  return (
    <div className={styles.recit}>
      <div className={styles.corps}>
        <div className={styles.fiche}>
          {photo ? (
            <img className={styles.vignette} src={photo} alt="" />
          ) : (
            <span className={styles.vignette} aria-hidden="true" />
          )}
          <span className={styles.ficheTexte}>
            <span className={styles.nomLieu}>{brouillon.nom.trim()}</span>
            {principale && (
              <span
                className={styles.badge}
                style={principale.couleur ? { '--type': principale.couleur } : undefined}
              >
                {principale.nom}
              </span>
            )}
          </span>
        </div>

        <h1 className={styles.titre}>Raconte-le</h1>
        <p className={styles.chapo}>
          Ce que tu y as vu, ce qu’on en dit, comment y aller. Trois lignes suffisent.
        </p>

        <div className={styles.carnet}>
          <textarea
            ref={carnet}
            className={styles.texte}
            aria-label="Le récit"
            value={recit}
            maxLength={MAX_SIGNES}
            placeholder="Perché sur l’éperon qui domine la vallée…"
            onChange={(e) => {
              changer({ recit: e.target.value })
            }}
          />
          <span className={styles.compte}>{recit.length} signes</span>
        </div>

        <h2 className={styles.etiquette}>Des pistes, si tu sèches</h2>
        <div className={styles.pistes}>
          {PISTES.map((p) => (
            <button
              key={p.libelle}
              type="button"
              className={styles.piste}
              onClick={() => {
                glisser(p.amorce)
              }}
            >
              ＋ {p.libelle}
            </button>
          ))}
        </div>
      </div>

      <BoutonSuivant
        libelle="Voir la fiche"
        manque={ceQuiManque(brouillon, 'recit')}
        onClick={onSuivant}
      />
    </div>
  )
}
