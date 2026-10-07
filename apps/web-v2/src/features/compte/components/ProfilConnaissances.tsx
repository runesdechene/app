/**
 * QUOI     — « Connaissances » : ce qu'on a gagné en perçant les énigmes, une gélule par culture —
 *            son cachet, son plus haut titre, autant d'étoiles que son rang (1 à 7), ses énigmes
 *            résolues — et Polymathe à part, sur une ligne qui défile (maquette 500:897).
 * POURQUOI — ce ne sont pas des titres qu'on porte (Uriel, 07/10) : une preuve qu'on est doué dans
 *            une culture, discrète, entre les lieux ajoutés et le passeport.
 * ATTENTION — sans connaissance, pas de section. Seules les étoiles gagnées s'affichent (Uriel).
 */
import { useGlisser } from '@/shared/hooks/useGlisser'
import type { Connaissance, ExplorateurProfile } from '../api/lireProfil'
import styles from './ProfilConnaissances.module.css'

export function ProfilConnaissances({ profil }: { profil: ExplorateurProfile }) {
  const glisser = useGlisser()
  const { connaissances, polymathe } = profil
  if (connaissances.length === 0 && !polymathe) return null
  return (
    <section className={styles.section} aria-label="Connaissances">
      <h2 className={styles.titre}>
        Connaissances <span className={styles.nombre}>{connaissances.length}</span>
      </h2>
      <p className={styles.aide}>Gagnées en perçant les énigmes de chaque culture</p>
      {/* Une ligne qui défile : cadre flex > rangée flex: 1 (règle « carrousel », interface.md). */}
      <div className={styles.cadre}>
        <ul ref={glisser} className={styles.rangee}>
          {polymathe && (
            <li className={styles.gelule} data-polymathe>
              <span className={styles.sceau} aria-hidden="true">
                <span className={styles.coeur}>✦</span>
              </span>
              <span className={styles.texte}>
                <span className={styles.nom}>{polymathe}</span>
                <span className={styles.ligne}>Sage dans trois cultures</span>
              </span>
            </li>
          )}
          {connaissances.map((c) => (
            <Gelule key={c.culture.id} connaissance={c} />
          ))}
        </ul>
      </div>
    </section>
  )
}

function Gelule({ connaissance: c }: { connaissance: Connaissance }) {
  return (
    <li
      className={styles.gelule}
      style={c.culture.couleur ? { '--couleur-culture': c.culture.couleur } : undefined}
    >
      <span className={styles.sceau} aria-hidden="true">
        <span className={styles.coeur}>
          {c.culture.icone ? (
            <span className={styles.logo} style={{ '--icone': `url("${c.culture.icone}")` }} />
          ) : (
            c.culture.nom.charAt(0)
          )}
        </span>
      </span>
      <span className={styles.texte}>
        <span className={styles.nom}>{c.titre}</span>
        <span className={styles.ligne}>
          <span className={styles.etoiles} role="img" aria-label={`rang ${String(c.rang)} sur 7`}>
            {'★'.repeat(c.rang)}
          </span>
          {`${String(c.enigmes)} ${c.enigmes > 1 ? 'énigmes' : 'énigme'}`}
        </span>
      </span>
    </li>
  )
}
