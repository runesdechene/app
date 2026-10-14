/**
 * QUOI     — la barre d'onglets du téléphone (85 px, comme l'appli) : Accueil, Communauté,
 *            Le jeu, Boutique, Plus.
 */
import { NavLink } from 'react-router'
import { ONGLETS, type Onglet } from './menu'
import styles from './BarreDOnglets.module.css'

const TRACES: Record<Onglet['icone'], string[]> = {
  accueil: ['M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z'],
  communaute: ['M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5', 'M17 14c2.4.2 4 1.8 4.5 4.5'],
  jeu: ['M12 3 4 7v6c0 4.5 3.4 7.6 8 8 4.6-.4 8-3.5 8-8V7z', 'M12 8v5M12 16v.5'],
  boutique: ['M5 8h14l-1.2 12H6.2z', 'M9 8V6a3 3 0 0 1 6 0v2'],
  plus: ['M5 12h.01M12 12h.01M19 12h.01'],
}
const CERCLES: Partial<Record<Onglet['icone'], [number, number, number][]>> = {
  communaute: [[9, 8, 3.5], [17, 9, 2.5]],
}

export function BarreDOnglets() {
  return (
    <nav className={styles.barre} aria-label="Onglets du Hub">
      {ONGLETS.map((o) => (
        <NavLink key={o.chemin} to={o.chemin} end={o.chemin === '/'} className={styles.onglet ?? ''}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {TRACES[o.icone].map((d) => <path key={d} d={d} />)}
            {(CERCLES[o.icone] ?? []).map(([cx, cy, r]) => <circle key={`${String(cx)}-${String(cy)}`} cx={cx} cy={cy} r={r} />)}
          </svg>
          <span>{o.libelle}</span>
        </NavLink>
      ))}
    </nav>
  )
}
