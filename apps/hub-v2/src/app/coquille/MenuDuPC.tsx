/**
 * QUOI     — le menu du PC : la marque, puis les domaines et leurs liens, avec la pastille des
 *            files qui attendent (maquette « Hub — Ouverture (PC) », Figma 579:615).
 */
import { NavLink } from 'react-router'
import logo from '@/assets/ui/logo-runes-de-chene.webp'
import { MENU } from './menu'
import { useAttente } from './useAttente'
import styles from './MenuDuPC.module.css'

export function MenuDuPC() {
  const attente = useAttente()
  return (
    <nav className={styles.menu} aria-label="Menu du Hub">
      <div className={styles.marque}>
        <img src={logo} alt="Runes de Chêne" />
        <span className={styles.role}>Le Hub · Pilotage</span>
      </div>
      {MENU.map((domaine) => (
        <div key={domaine.titre ?? 'accueil'} className={styles.domaine}>
          {domaine.titre && <p className={styles.titre}>{domaine.titre}</p>}
          {domaine.liens.map((lien) => {
            const nombre = lien.file ? (attente[lien.file] ?? 0) : 0
            return (
              <NavLink key={lien.chemin} to={lien.chemin} end className={styles.lien ?? ''}>
                <span>{lien.libelle}</span>
                {nombre > 0 && <span className={styles.pastille}>{nombre}</span>}
              </NavLink>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
