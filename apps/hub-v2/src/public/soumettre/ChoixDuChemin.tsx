/**
 * QUOI     — l'étape 1, « Que veux-tu partager ? » : deux cartes, « Des photos » et « Un avis » ; un
 *            clic sur l'une ouvre son chemin.
 * POURQUOI — un seul formulaire, deux chemins (spec avis et photos du 16/10, maquette Figma 644:1612) ;
 *            le choix compte comme la première étape (Uriel, 11/11). Chaque chemin garde l'autre en
 *            facultatif : une photo après l'avis, un avis après les photos.
 *            Pas de bouton « Commencer » (Uriel, 11/11) : la carte suffit.
 */
import { EnTete } from './Etape'
import type { Chemin } from './lib/formulaire'
import styles from './ChoixDuChemin.module.css'

const CARTES: { chemin: Chemin; icone: string; titre: string; texte: string; duree: string }[] = [
  {
    chemin: 'photos',
    icone: '📷',
    titre: 'Des photos',
    texte: 'Tes photos portées rejoignent l’accueil de la boutique et le mur « Ils nous portent ». Tu peux y joindre un avis.',
    duree: '≈ 3 minutes',
  },
  {
    chemin: 'avis',
    icone: '✍️',
    titre: 'Un avis',
    texte: 'Quelques étoiles et un mot sur le produit et ton expérience. Tu pourras ajouter une photo.',
    duree: '≈ 30 secondes',
  },
]

export function ChoixDuChemin({ choisir }: { choisir: (chemin: Chemin) => void }) {
  return (
    <>
      <EnTete surTitre="Étape 1 sur 4" titre="Que veux-tu partager ?">
        Deux façons de raconter ce que tu vis avec Runes de Chêne.
      </EnTete>

      <div className={styles.cartes}>
        {CARTES.map((c) => (
          <button
            key={c.chemin}
            type="button"
            className={styles.carte}
            onClick={() => {
              choisir(c.chemin)
            }}
          >
            <span className={styles.icone} aria-hidden="true">
              {c.icone}
            </span>
            <span className={styles.titre}>{c.titre}</span>
            <span className={styles.texte}>{c.texte}</span>
            <span className={styles.duree}>{c.duree}</span>
          </button>
        ))}
      </div>
      <p className={styles.note}>Tu es ambassadeur ou partenaire ? Choisis « Des photos ».</p>

    </>
  )
}
