/**
 * QUOI     — la navigation entre les pages d'une liste : « 1 à 50 sur 4 750 », précédents, suivants.
 */
import styles from './Pages.module.css'

const nombre = new Intl.NumberFormat('fr-FR')

export function Pages({ total, decalage, parPage, onDecalage }: {
  total: number; decalage: number; parPage: number; onDecalage: (decalage: number) => void
}) {
  if (total <= parPage) return null
  const fin = Math.min(decalage + parPage, total)
  return (
    <div className={styles.pages}>
      <span>{`${nombre.format(decalage + 1)} à ${nombre.format(fin)} sur ${nombre.format(total)}`}</span>
      <span className={styles.boutons}>
        <button type="button" disabled={decalage === 0} onClick={() => {
          onDecalage(Math.max(0, decalage - parPage))
        }}>← Précédents</button>
        <button type="button" disabled={fin >= total} onClick={() => {
          onDecalage(decalage + parPage)
        }}>Suivants →</button>
      </span>
    </div>
  )
}
