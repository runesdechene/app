/**
 * QUOI     — la feuille du « + » : ajouter sur la carte un lieu, un point d'intérêt ou un pin GPS
 *            (maquette « Carte — Ajouter (feuille ouverte) », 201:216).
 * POURQUOI — l'en-tête est commun à tous les onglets : on ajoute de partout, pas seulement depuis
 *            la carte (Uriel, 28/09).
 * ATTENTION — les trois parcours arrivent avec le plan 2 : pour l'instant chaque ligne est
 *            désactivée et le dit (« bientôt »).
 */
import chevron from '@/assets/ui/chevron.svg'
import lieu from '@/assets/ui/lieu.svg'
import pinGps from '@/assets/ui/pin-gps.svg'
import pointInteret from '@/assets/ui/point-interet.svg'
import { Feuille } from '@/shared/ui/Feuille'
import styles from './AjouterFeuille.module.css'

const CHOIX = [
  {
    titre: 'Un lieu',
    texte: 'Un lieu oublié que tu veux faire connaître : photo, récit, position.',
    icone: lieu,
  },
  {
    titre: 'Un point d’intérêt',
    texte:
      'Anecdote, objet, curiosité locale, établissement dans l’esprit de la marque... trop petit pour être un lieu, mais qui mérite d’être partagé aux autres membres.',
    icone: pointInteret,
  },
  {
    titre: 'Un pin GPS',
    texte:
      'Marque ta position maintenant, et complète le plus tard. Idéal pour aller vite et profiter de ton explo.',
    icone: pinGps,
  },
] as const

export function AjouterFeuille({ onFermer }: { onFermer: () => void }) {
  return (
    <Feuille titre="Ajouter sur la carte" onFermer={onFermer}>
      <p className={styles.titre}>Ajouter sur la carte</p>
      {CHOIX.map((c) => (
        <button key={c.titre} type="button" className={styles.choix} disabled>
          <img className={styles.icone} src={c.icone} alt="" />
          <span className={styles.texte}>
            <span className={styles.nom}>
              {c.titre} <span className={styles.bientot}>bientôt</span>
            </span>
            <span className={styles.description}>{c.texte}</span>
          </span>
          <img className={styles.chevron} src={chevron} alt="" />
        </button>
      ))}
    </Feuille>
  )
}
