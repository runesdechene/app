/**
 * QUOI     — la page « Les énigmes » (maquette 478:452) : combien d'énigmes résolues sur le total,
 *            puis une ligne par culture — sa pastille, « 14 / 72 résolues », une fine jauge — qui
 *            ouvre ce qu'on y a appris.
 * POURQUOI — Uriel, 07/10 : « qu'on sache combien d'énigmes on a déjà répondues juste ». Ni
 *            pourcentage ni titres : la progression vit dans « Tous les titres », le jeu sur la carte.
 */
import { Text } from '@/shared/ui/Text'
import { useMesEnigmes } from '../hooks/useMesEnigmes'
import { resoluesEnClair } from '../lib/enClair'
import { PastilleCulture } from './PastilleCulture'
import styles from './PageEnigmes.module.css'

export function PageEnigmes({ onOuvrirCulture }: { onOuvrirCulture: (id: string) => void }) {
  const { mesEnigmes, erreur, reessayer } = useMesEnigmes()

  if (erreur) {
    return (
      <div className={styles.page}>
        <Text variant="corps">Tes énigmes n’ont pas pu se charger.</Text>
        <button
          type="button"
          className={styles.reessayer}
          onClick={() => {
            void reessayer()
          }}
        >
          Réessayer
        </button>
      </div>
    )
  }
  if (!mesEnigmes) return null

  return (
    <div className={styles.page}>
      <div className={styles.resume}>
        <p className={styles.aide}>Ce que tu as appris en perçant les « ? » de la carte.</p>
        <p className={styles.compte}>
          <span className={styles.nombre}>{mesEnigmes.resolues}</span>
          <span>{`${resoluesEnClair(mesEnigmes.resolues)} sur ${String(mesEnigmes.total)}`}</span>
        </p>
        <p className={styles.aide}>Touche une culture pour relire ses réponses et ses « Le savais-tu ? ».</p>
      </div>
      <ul className={styles.cultures}>
        {mesEnigmes.cultures.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className={styles.culture}
              style={c.couleur ? { '--couleur-culture': c.couleur } : undefined}
              onClick={() => {
                onOuvrirCulture(c.id)
              }}
            >
              <span className={styles.tete}>
                <PastilleCulture icone={c.icone} couleur={c.couleur} taille="petite" />
                <span className={styles.nom}>
                  <span className={styles.titre}>{c.nom}</span>
                  <span className={styles.part}>{`${String(c.resolues)} / ${String(c.total)} résolues`}</span>
                </span>
                <span className={styles.chevron} aria-hidden="true">
                  ›
                </span>
              </span>
              <span className={styles.piste} aria-hidden="true">
                <span
                  className={styles.rempli}
                  style={{ '--mesure': String(c.total > 0 ? c.resolues / c.total : 0) }}
                />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
