/**
 * QUOI     — « À explorer près de toi » (maquette 275:128, bloc 282:146) : les trois lieux les
 *            plus proches, à 100 km au plus, que je n'ai pas encore visités en GPS — la photo,
 *            le nom, le type et sa bille, la distance. Un lieu ouvre sa fiche dans l'Accueil.
 * POURQUOI — le seul bloc de l'Accueil qui pousse à sortir aujourd'hui (Uriel, 29/09) : les
 *            Ajoutés racontent ce que la communauté découvre, souvent loin. Sans position
 *            partagée, ou rien à moins de 100 km, le bloc ne s'affiche pas.
 */
import { aLaTaille } from '@/shared/lib/image'
import { Link } from 'react-router'
import sectionPresDeToi from '@/assets/ui/pin-gps.svg'
import { formatDistance } from '@/shared/lib/distance'
import { useMaPosition } from '@/shared/hooks/useMaPosition'
import { usePresDeMoi } from '../hooks/useAccueil'
import { BilleType } from '@/shared/ui/BilleType'
import styles from './PresDeToi.module.css'

export function PresDeToi() {
  const lieux = usePresDeMoi(useMaPosition())
  if (lieux.length === 0) return null
  return (
    <section className={styles.presDeToi} aria-label="À explorer près de toi">
      <h2 className={styles.rubrique}>
        <img className={styles.icone} src={sectionPresDeToi} alt="" />À explorer près de toi
      </h2>
      <ul className={styles.lieux} aria-label="À explorer près de toi">
        {lieux.map((l) => (
          <li key={l.id}>
            <Link className={styles.lieu} to={`/accueil/lieu/${l.id}`}>
              {l.imageUrl ? (
                <img
                  className={styles.vignette}
                  src={aLaTaille(l.imageUrl, 56)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span className={styles.vignette} aria-hidden="true" />
              )}
              <span className={styles.texte}>
                <span className={styles.nom}>{l.nom}</span>
                {l.type && (
                  <span className={styles.type}>
                    {l.type.icone && <BilleType icone={l.type.icone} couleur={l.type.couleur} />}
                    {l.type.nom}
                  </span>
                )}
              </span>
              <span className={styles.distance}>{formatDistance(l.metres / 1000)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
