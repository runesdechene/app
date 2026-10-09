/**
 * QUOI     — une culture dans « Les énigmes » (maquette 478:526) : son portrait (réglé dans le Hub),
 *            « 14 / 72 résolues », l'encart de
 *            ce qui reste à percer (où ça s'éveille, et le lien qui vole sur la carte), puis chaque
 *            énigme résolue, à son numéro fixe — sa question, qui se déplie sur sa réponse et son « Le
 *            savais-tu ? » —, rangées par date de réussite (la plus récente en tête) ou par numéro. Tout en écriture droite et lisible : l'italique penchée ne se lisait pas (Uriel, 07/10).
 * POURQUOI — ce qu'on a appris se relit (Uriel, 07/10). Les énigmes ratées n'y sont pas : elles
 *            reviendront sur la carte.
 */
import { useState } from 'react'
import { Link } from 'react-router'
import { Segments } from '@/shared/ui/Segments'
import { Text } from '@/shared/ui/Text'
import { useMaCulture } from '../hooks/useMesEnigmes'
import {
  encartEnClair,
  lienVersLaCarte,
  prochainEnClair,
  quandEnClair,
  rangerEnigmes,
  resoluesEnClair,
  type Tri,
} from '../lib/enClair'
import { PastilleCulture } from './PastilleCulture'
import styles from './PageCulture.module.css'

const TRIS = [
  { id: 'date', libelle: 'Par date' },
  { id: 'numero', libelle: 'Par numéro' },
] as const

export function PageCulture({ id }: { id: string }) {
  const { maCulture, erreur } = useMaCulture(id)
  const [tri, setTri] = useState<Tri>('date')

  if (erreur) {
    return (
      <div className={styles.page}>
        <Text variant="corps">Cette culture n’a pas pu se charger.</Text>
      </div>
    )
  }
  if (!maCulture) return null

  const { culture, resolues, total, grade, prochain, centre, enigmes } = maCulture
  const encart = encartEnClair(total - resolues, culture.nom, culture.zone)
  return (
    <div className={styles.page} style={culture.couleur ? { '--couleur-culture': culture.couleur } : undefined}>
      {/* Le portrait de la culture, réglé dans le Hub : donner envie de s'y intéresser (Uriel, 07/10). */}
      {culture.presentation && (
        <section className={styles.portrait} aria-label={`${culture.nom}, en quelques mots`}>
          <p className={styles.portraitTexte}>{culture.presentation}</p>
        </section>
      )}
      <div className={styles.resume}>
        <PastilleCulture icone={culture.icone} couleur={culture.couleur} taille="grande" />
        <p className={styles.compte}>
          <span className={styles.nombre}>{`${String(resolues)} / ${String(total)}`}</span>
          <span>{resoluesEnClair(resolues)}</span>
        </p>
      </div>
      <span className={styles.piste} aria-hidden="true">
        <span className={styles.rempli} style={{ '--mesure': String(total > 0 ? resolues / total : 0) }} />
      </span>

      {/* Mon grade (le plus haut titre gagné ici, ses étoiles) et ce qui manque pour le suivant :
          la progression vit ici, pas dans « Tous les titres » (Uriel, 07/10 — migration 452). */}
      <section className={styles.grade} aria-label="Mon grade">
        {grade && (
          <p className={styles.gradeTitre}>
            {grade.titre}
            <span className={styles.etoiles} role="img" aria-label={`rang ${String(grade.rang)} sur 7`}>
              {'★'.repeat(grade.rang)}
            </span>
          </p>
        )}
        <p className={styles.gradeSuivant}>{prochainEnClair(prochain)}</p>
      </section>

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

      {enigmes.length > 1 && (
        <Segments libelle="Ranger les énigmes" options={TRIS} valeur={tri} onChange={setTri} />
      )}
      <ul className={styles.appris}>
        {rangerEnigmes(enigmes, tri).map((e) => (
          <li key={e.numero} className={styles.carte}>
            {/* Repliée, la question ; dépliée au toucher, la réponse et le savais-tu (Uriel, 07/10). */}
            <details className={styles.pli}>
              <summary className={styles.sommaire}>
                <span className={styles.tete}>
                  {/* Son numéro fixe, le même pour tous : « je bloque sur la 242 » (Uriel, 07/10). */}
                  <span className={styles.numero}>{`N° ${String(e.numero)}`}</span>
                  <span className={styles.quand}>{quandEnClair(e.le)}</span>
                </span>
                <span className={styles.question}>{e.question}</span>
              </summary>
              <div className={styles.deplie}>
                <span className={styles.reponse}>
                  <span className={styles.etiquette}>Réponse</span>
                  <span className={styles.bonne}>{e.reponse}</span>
                </span>
                <span className={styles.savais}>
                  <span className={styles.etiquette}>Le savais-tu ?</span>
                  <span>{e.explication}</span>
                </span>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  )
}
