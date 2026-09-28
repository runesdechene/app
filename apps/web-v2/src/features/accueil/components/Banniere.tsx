/**
 * QUOI     — la bannière de la boutique, en tête de l'Accueil : une Saga tirée au hasard parmi
 *            les bannières actives du Hub — l'image, un voile, « Boutique », le titre, une ligne.
 * POURQUOI — un bandeau de pub, le même que la V1 (Uriel, 28/09) : ses couleurs sont celles
 *            réglées dans le Hub, bannière par bannière, passées au CSS en variables. Toute la
 *            carte mène à la boutique.
 */
import { useBanniere } from '../hooks/useAccueil'
import styles from './Banniere.module.css'

export function Banniere() {
  const banniere = useBanniere()
  if (!banniere) return null
  return (
    <a
      className={styles.banniere}
      href={banniere.lien}
      target="_blank"
      rel="noreferrer"
      style={{
        '--voile': banniere.voile.couleur,
        '--voile-force': String(banniere.voile.opacite),
        '--teinte-tag': banniere.couleurs.tag,
        '--teinte-titre': banniere.couleurs.titre,
        '--teinte-sous-titre': banniere.couleurs.sousTitre,
        '--ombre-texte': banniere.ombre.couleur,
        '--ombre-force': String(banniere.ombre.force),
      }}
    >
      <img className={styles.image} src={banniere.image} alt="" />
      <span className={styles.voile} aria-hidden="true" />
      <span className={styles.texte}>
        <span className={styles.tag}>Boutique</span>
        <span className={styles.titre}>{banniere.titre}</span>
        {banniere.sousTitre && <span className={styles.sousTitre}>{banniere.sousTitre}</span>}
      </span>
    </a>
  )
}
