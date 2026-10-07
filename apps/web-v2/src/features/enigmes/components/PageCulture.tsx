/**
 * QUOI     — une culture dans « Les énigmes » (maquette 478:526) : « 14 / 72 résolues », l'encart de
 *            ce qui reste à percer (où ça s'éveille, et le lien qui vole sur la carte), puis chaque
 *            énigme résolue, numérotée — sa question, sa réponse, son « Le savais-tu ? » — la plus récente en
 *            tête. Tout en écriture droite et lisible : l'italique penchée ne se lisait pas (Uriel, 07/10).
 * POURQUOI — ce qu'on a appris se relit (Uriel, 07/10). Les énigmes ratées n'y sont pas : elles
 *            reviendront sur la carte.
 */
import { Link } from 'react-router'
import { Text } from '@/shared/ui/Text'
import { useMaCulture } from '../hooks/useMesEnigmes'
import { encartEnClair, lienVersLaCarte, quandEnClair } from '../lib/enClair'
import { PastilleCulture } from './PastilleCulture'
import styles from './PageCulture.module.css'

export function PageCulture({ id }: { id: string }) {
  const { maCulture, erreur } = useMaCulture(id)

  if (erreur) {
    return (
      <div className={styles.page}>
        <Text variant="corps">Cette culture n’a pas pu se charger.</Text>
      </div>
    )
  }
  if (!maCulture) return null

  const { culture, resolues, total, centre, enigmes } = maCulture
  const encart = encartEnClair(total - resolues, culture.nom, culture.zone)
  return (
    <div className={styles.page} style={culture.couleur ? { '--couleur-culture': culture.couleur } : undefined}>
      <div className={styles.resume}>
        <PastilleCulture icone={culture.icone} couleur={culture.couleur} taille="grande" />
        <p className={styles.compte}>
          <span className={styles.nombre}>{`${String(resolues)} / ${String(total)}`}</span>
          <span>résolues</span>
        </p>
      </div>
      <span className={styles.piste} aria-hidden="true">
        <span className={styles.rempli} style={{ '--mesure': String(total > 0 ? resolues / total : 0) }} />
      </span>

      <section className={styles.encart} aria-label={encart.titre}>
        <span className={styles.sceau} aria-hidden="true">
          ?
        </span>
        <div className={styles.encartTexte}>
          <h2 className={styles.encartTitre}>{encart.titre}</h2>
          <p className={styles.encartPhrase}>{encart.phrase}</p>
          {centre && resolues < total && (
            <Link className={styles.lien} to={lienVersLaCarte(centre)}>
              Les chercher sur la carte →
            </Link>
          )}
        </div>
      </section>

      <ul className={styles.appris}>
        {enigmes.map((e, i) => (
          <li key={`${e.reponse}-${e.le}`} className={styles.carte}>
            <span className={styles.tete}>
              {/* La plus récente est en tête : son numéro est le plus grand, la première percée est le n° 1. */}
              <span className={styles.numero}>{`N° ${String(enigmes.length - i)}`}</span>
              <span className={styles.quand}>{quandEnClair(e.le)}</span>
            </span>
            <span className={styles.question}>{e.question}</span>
            <span className={styles.reponse}>
              <span className={styles.etiquette}>Réponse</span>
              <span className={styles.bonne}>{e.reponse}</span>
            </span>
            <span className={styles.savais}>
              <span className={styles.etiquette}>Le savais-tu ?</span>
              <span>{e.explication}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
