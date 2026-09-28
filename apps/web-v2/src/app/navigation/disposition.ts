/**
 * QUOI     — ce qui est ouvert pour une adresse : l'onglet actif, un détail (fiche, profil,
 *            Préférences), une feuille (« Ajouter »), et le tiroir du desktop.
 * POURQUOI — une règle pure, lue par la coquille : le CSS décide ensuite où chaque chose se
 *            place selon la largeur. Sur desktop, la carte est toujours là et tout le reste
 *            s'ouvre dans le tiroir (spec socle §4bis, Uriel 28/09).
 */
import { tabOf, type TabId } from './tabs'

// Ce qui s'ouvre par-dessus l'onglet en FEUILLE (depuis le bas), et non en détail.
const FEUILLES = new Set(['ajouter'])

export type Disposition = {
  actif: TabId | null
  detail: boolean
  feuille: boolean
  tiroir: boolean
}

export function disposition(pathname: string): Disposition {
  const actif = tabOf(pathname)
  // Par-dessus l'onglet : un segment après lui (/carte/ajouter, /carte/lieu/…). Segments vides
  // ignorés (/carte/).
  const segments = pathname.split('/').filter(Boolean)
  const dessus = segments[1]
  const feuille = dessus !== undefined && FEUILLES.has(dessus)
  const detail = dessus !== undefined && !feuille
  return { actif, detail, feuille, tiroir: detail || (actif !== null && actif !== 'carte') }
}
