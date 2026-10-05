/**
 * QUOI     — « C'est réservé aux Porteurs » (maquette 396:404) : qui sont les Porteurs, la boutique,
 *            et l'autre chemin : rejoindre une Compagnie.
 * POURQUOI — fonder une antenne, c'est porter la marque sur les chemins (Uriel, 05/10) ; rejoindre
 *            reste ouvert à tous. L'écran dit pourquoi, sans reproche, et où aller.
 */
import { Link } from 'react-router'
import sceau from '@/assets/ui/sceau-murmure.webp'
import styles from './ReserveAuxPorteurs.module.css'

export function ReserveAuxPorteurs() {
  return (
    <div className={styles.ecran}>
      <img className={styles.sceau} src={sceau} alt="" />
      <h2 className={styles.titre}>Fonder une Compagnie</h2>
      <p className={styles.raison}>C’est réservé aux Porteurs</p>
      <p className={styles.texte}>
        Les Porteurs portent au moins un Fragment de Runes de Chêne : il arrive avec chaque vêtement
        de la boutique. Fonder une antenne, c’est porter la marque sur les chemins.
      </p>
      <p className={styles.aside}>Rejoindre une Compagnie, lui, est ouvert à tous.</p>
      <a className={styles.boutique} href="https://runesdechene.com" target="_blank" rel="noopener">
        Découvrir la boutique ›
      </a>
      <Link className={styles.rejoindre} to="/compagnies">
        Rejoindre une Compagnie
      </Link>
      <p className={styles.client}>
        Déjà client ? Ton Fragment rejoint le compte de l’e-mail de ta commande.
      </p>
    </div>
  )
}
