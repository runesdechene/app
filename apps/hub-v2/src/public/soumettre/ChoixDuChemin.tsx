/**
 * QUOI     — l'écran 0, « Que veux-tu partager ? » : deux cartes, « Un avis avec photos » et « Un avis
 *            seul », puis « Commencer ».
 * POURQUOI — un seul formulaire, deux chemins (spec avis et photos du 16/10, maquette Figma 644:1612).
 *            La carte choisie ne fait que se marquer : c'est « Commencer » qui écrit le chemin dans
 *            l'adresse, comme le bouton « Suivant » écrit l'étape.
 */
import { useState } from 'react'
import { BoutonSombre, EnTete, Navigation } from './Etape'
import type { Chemin } from './lib/formulaire'
import styles from './ChoixDuChemin.module.css'

const CARTES: { chemin: Chemin; icone: string; titre: string; texte: string; duree: string }[] = [
  {
    chemin: 'photos',
    icone: '📷',
    titre: 'Un avis avec photos',
    texte: 'Tes photos portées rejoignent l’accueil de la boutique et le mur « Ils nous portent ». Ton avis va sur la fiche du produit.',
    duree: '≈ 3 minutes',
  },
  {
    chemin: 'avis',
    icone: '✍️',
    titre: 'Un avis seul',
    texte: 'Quelques étoiles et un mot sur le textile et ton expérience. Il va sur la fiche du produit.',
    duree: '≈ 30 secondes',
  },
]

export function ChoixDuChemin({ choisir }: { choisir: (chemin: Chemin) => void }) {
  const [choix, setChoix] = useState<Chemin | null>(null)
  return (
    <>
      <EnTete surTitre="Pour commencer" titre="Que veux-tu partager ?">
        Deux façons de raconter ce que tu vis avec Runes de Chêne.
      </EnTete>

      <div className={styles.cartes}>
        {CARTES.map((c) => (
          <button
            key={c.chemin}
            type="button"
            className={styles.carte}
            aria-pressed={choix === c.chemin}
            onClick={() => {
              setChoix(c.chemin)
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
      <p className={styles.note}>Tu es ambassadeur ou partenaire ? Choisis « Un avis avec photos ».</p>

      <Navigation>
        <BoutonSombre
          disabled={choix === null}
          onClick={() => {
            if (choix) choisir(choix)
          }}
        >
          Commencer →
        </BoutonSombre>
      </Navigation>
    </>
  )
}
