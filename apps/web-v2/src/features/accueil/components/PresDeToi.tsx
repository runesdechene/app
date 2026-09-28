/**
 * QUOI     — « Près de toi » (maquette 275:128, bloc 282:146) : les trois lieux les plus proches, à
 *            100 km au plus, que je n'ai pas encore visités en GPS — la photo, le nom, le type
 *            dans sa couleur, la distance. Un lieu ouvre sa fiche dans l'Accueil.
 * POURQUOI — le seul bloc de l'Accueil qui pousse à sortir aujourd'hui (Uriel, 29/09) : les
 *            Ajoutés racontent ce que la communauté découvre, souvent loin. Sans position
 *            partagée, ou rien à moins de 100 km, le bloc ne s'affiche pas.
 */
import { Link } from 'react-router'
import sectionPresDeToi from '@/assets/ui/pin-gps.svg'
import { formatDistance } from '@/shared/lib/distance'
import { VENU_D_UN_ECRAN } from '@/shared/lib/retour'
import { useMaPosition } from '@/shared/hooks/useMaPosition'
import { usePresDeMoi } from '../hooks/useAccueil'
import styles from './PresDeToi.module.css'

export function PresDeToi() {
  const lieux = usePresDeMoi(useMaPosition())
  if (lieux.length === 0) return null
  return (
    <section className={styles.presDeToi} aria-label="Près de toi">
      <h2 className={styles.rubrique}>
        <img className={styles.icone} src={sectionPresDeToi} alt="" />
        Près de toi
      </h2>
      <ul className={styles.lieux} aria-label="Près de toi">
        {lieux.map((l) => (
          <li key={l.id}>
            <Link className={styles.lieu} to={`/accueil/lieu/${l.id}`} state={VENU_D_UN_ECRAN}>
              {l.imageUrl ? (
                <img className={styles.vignette} src={l.imageUrl} alt="" />
              ) : (
                <span className={styles.vignette} aria-hidden="true" />
              )}
              <span className={styles.texte}>
                <span className={styles.nom}>{l.nom}</span>
                {l.type && (
                  <span
                    className={styles.type}
                    style={l.type.couleur ? { '--type': l.type.couleur } : undefined}
                  >
                    {l.type.icone && (
                      <span
                        className={styles.typeIcone}
                        style={{ '--icone': `url(${l.type.icone})` }}
                        aria-hidden="true"
                      />
                    )}
                    {l.type.nom}
                  </span>
                )}
              </span>
              <span className={styles.distance}>{formatDistance(l.metres / 1000)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link className={styles.carte} to="/carte">
        Voir sur la carte
      </Link>
    </section>
  )
}
