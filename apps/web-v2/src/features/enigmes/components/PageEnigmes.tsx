/**
 * QUOI     — la page « Les énigmes » : un bilan en tête (« 194 énigmes résolues sur 419 », sa jauge,
 *            une phrase), puis une carte par culture — sa pastille, son nom, « 61 / 77 énigmes
 *            résolues », sa jauge — qui ouvre ce qu'on y a appris.
 *            Refaite le 07/10 (Uriel : « trop petit, ça ne se voit pas ») ; on dit « énigmes », jamais
 *            « les ? ».
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

  const part = mesEnigmes.total > 0 ? mesEnigmes.resolues / mesEnigmes.total : 0
  return (
    <div className={styles.page}>
      <section className={styles.bilan} aria-label="Mes énigmes">
        <p className={styles.compte}>
          <span className={styles.nombre}>{mesEnigmes.resolues}</span>
          <span className={styles.sur}>{`${resoluesEnClair(mesEnigmes.resolues)} sur ${String(mesEnigmes.total)}`}</span>
        </p>
        <span className={styles.piste} data-grande aria-hidden="true">
          <span className={styles.rempli} style={{ '--mesure': String(part) }} />
        </span>
        <p className={styles.phrase}>
          Chaque énigme que tu perces sur la carte t’apprend un fait d’Histoire. Retrouve-les ici, culture
          par culture.
        </p>
      </section>
      <h2 className={styles.rubrique}>Par culture</h2>
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
              <PastilleCulture icone={c.icone} couleur={c.couleur} taille="grande" />
              <span className={styles.nom}>
                <span className={styles.titre}>{c.nom}</span>
                <span className={styles.part}>{`${String(c.resolues)} / ${String(c.total)} ${resoluesEnClair(c.resolues)}`}</span>
                <span className={styles.piste} aria-hidden="true">
                  <span
                    className={styles.rempli}
                    style={{ '--mesure': String(c.total > 0 ? c.resolues / c.total : 0) }}
                  />
                </span>
              </span>
              <span className={styles.chevron} aria-hidden="true">
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
