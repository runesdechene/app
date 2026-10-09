/**
 * QUOI     — la feuille d'un titre touché (maquettes « Titres — 3a/3b ») : obtenu (comment, et où
 *            on en est), ou à gagner (comment, et la barre).
 * POURQUOI — toucher un titre l'explique (Uriel, 27/09). Pas de « Porter ce titre » : le choix
 *            reste dans « Modifier mon profil » (Uriel, 06/10).
 */
import { phraseCondition, type ConditionTitre } from '@/shared/lib/conditionTitre'
import { Feuille } from '@/shared/ui/Feuille'
import { Text } from '@/shared/ui/Text'
import { compteurEnClair } from '../lib/chemins'
import styles from './FeuilleTitre.module.css'

export type TitreTouche = {
  nom: string
  cas: 'obtenu' | 'a-gagner'
  condition: ConditionTitre | null
  compteur: number | null
}

export function FeuilleTitre({ titre, onFermer }: { titre: TitreTouche; onFermer: () => void }) {
  const phrase = phraseCondition(titre.condition)
  const compteur = titre.compteur ?? 0
  return (
    <Feuille titre={titre.nom} onFermer={onFermer}>
      <div className={styles.feuille}>
        <span className={styles.gelule} data-obtenu={titre.cas !== 'a-gagner' || undefined}>
          <span aria-hidden="true">✦</span>
          {titre.nom}
        </span>
        {titre.cas === 'obtenu' && (
          <>
            <Text variant="corps">{phrase}</Text>
            <Text variant="sous-titre">{`Aujourd’hui : ${titre.condition ? compteurEnClair(titre.condition.stat, compteur) : String(compteur)}.`}</Text>
            <Text variant="legende">
              Tu choisis les trois titres de ton profil dans « Modifier mon profil ».
            </Text>
          </>
        )}
        {titre.cas === 'a-gagner' && titre.condition && (
          <>
            <Text variant="corps">{phrase.replace('Débloqué', 'Se gagne')}</Text>
            <Barre valeur={compteur} max={titre.condition.min} nom={titre.nom} />
            <Text variant="sous-titre">
              {`${String(compteur)} / ${String(titre.condition.min)} — encore ${String(titre.condition.min - compteur)}`}
            </Text>
          </>
        )}
      </div>
    </Feuille>
  )
}

export function Barre({ valeur, max, nom }: { valeur: number; max: number; nom: string }) {
  return (
    <div
      className={styles.barre}
      role="progressbar"
      aria-label={nom}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={valeur}
    >
      <span style={{ '--mesure': `${String(Math.min(100, (valeur / max) * 100))}%` }} />
    </div>
  )
}
