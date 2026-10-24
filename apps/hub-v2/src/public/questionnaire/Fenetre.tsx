/**
 * QUOI     — la fenêtre du questionnaire (maquette 776:2696) : le bandeau sombre (la marque, le titre, la
 *            frise des sept questions), le corps sur le parchemin, et le pied qui porte les boutons.
 * POURQUOI — sur PC, une fenêtre de téléphone posée au centre de la photo floutée ; au téléphone, elle
 *            est l'écran. La frise dit où on en est : faite (cochée), en cours (pleine), à venir (en creux).
 */
import type { ReactNode } from 'react'
import styles from './Fenetre.module.css'
import { ETAPES } from './lib/etapes'

/** `etape` : 0 avant la première question, 1 à 7 pendant, 8 une fois tout envoyé. */
export function Fenetre({ etape, sous, children, pied }: { etape: number; sous: string; children: ReactNode; pied?: ReactNode }) {
  return (
    <div className={styles.fenetre}>
      <header className={styles.entete}>
        <p className={styles.marque}>Runes de Chêne</p>
        <h1 className={styles.titre}>Dis-nous qui tu es</h1>
        <ol className={styles.frise} aria-hidden="true">
          {ETAPES.map((nom, i) => {
            const n = i + 1
            return (
              <li key={nom} data-etat={n < etape ? 'faite' : n === etape ? 'en-cours' : 'a-venir'}>
                <span className={styles.pastille}>{n < etape ? '✓' : n}</span>
              </li>
            )
          })}
        </ol>
        <p className={styles.sous}>{sous}</p>
      </header>
      {/* La clé rejoue le glissement à chaque question. */}
      <div key={etape} className={styles.corps}>
        {children}
      </div>
      {pied && <div className={styles.pied}>{pied}</div>}
    </div>
  )
}
