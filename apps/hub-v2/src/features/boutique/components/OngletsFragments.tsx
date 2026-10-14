/**
 * QUOI     — les trois onglets du domaine Fragments : la liste, la correspondance Shopify, les achats à associer.
 * POURQUOI — chaque onglet est une adresse (tout état navigable est une URL) ; le nombre d'achats à
 *            associer se pose au libellé de son onglet.
 */
import { NavLink } from 'react-router'
import styles from './Boutique.module.css'

export function OngletsFragments({ achats }: { achats?: number }) {
  return (
    <nav className={styles.onglets} aria-label="Fragments">
      <NavLink className={styles.onglet ?? ''} to="/boutique/fragments" end>Les Fragments</NavLink>
      <NavLink className={styles.onglet ?? ''} to="/boutique/fragments/correspondance">Correspondance Shopify</NavLink>
      <NavLink className={styles.onglet ?? ''} to="/boutique/fragments/achats">
        {achats === undefined ? 'Achats à associer' : `Achats à associer · ${String(achats)}`}
      </NavLink>
    </nav>
  )
}
