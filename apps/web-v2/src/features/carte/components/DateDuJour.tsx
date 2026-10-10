/**
 * QUOI     — la date du jour dans le calendrier du joueur, une ligne sous le nom du territoire.
 * POURQUOI — spec 2026-10-10-frise-des-epoques (« La date du jour ») : elle reste quand le nom
 *            s'efface au-dessus de la mer, donc elle ne vit pas dans `Inscription`.
 * ATTENTION — lue au rendu, sans minuterie : elle change au prochain rendu après minuit.
 */
import { dateEnClair } from '@runes/calendrier'
import { useCalendrier } from '@/shared/hooks/useCalendrier'
import styles from './DateDuJour.module.css'

export function DateDuJour() {
  const calendrier = useCalendrier()
  return <p className={styles.date}>{dateEnClair(new Date(), calendrier)}</p>
}
