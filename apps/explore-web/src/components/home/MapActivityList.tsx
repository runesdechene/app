import { useToastStore } from '../../stores/toastStore'
import { ToastItem } from '../map/overlays/GameToast'
import './MapActivityList.css'

interface MapActivityListProps {
  /** Nombre max d'events à afficher. Défaut 5. */
  limit?: number
  /** Callback "Voir tout →" — si défini, affiche un lien en bas. */
  onSeeMore?: () => void
}

/**
 * Liste l'activité publique récente de la carte (toasts cumulés du toastStore,
 * alimentés au boot par loadRecentActivityToasts via usePlayer). Réutilise
 * ToastItem de GameToast pour le rendu (mêmes highlights cliquables, mêmes
 * couleurs faction, etc.).
 *
 * Note : on lit le store déjà alimenté, on ne refait pas de RPC.
 */
export function MapActivityList({ limit = 5, onSeeMore }: MapActivityListProps) {
  const toasts = useToastStore((s) => s.toasts)
  const recent = [...toasts].reverse().slice(0, limit)

  if (recent.length === 0) {
    return (
      <div className="map-activity-list-empty">
        Pas d'activité récente sur la carte.
      </div>
    )
  }

  return (
    <div className="map-activity-list">
      {recent.map((t) => (
        <div key={t.id} className="map-activity-list-row">
          <ToastItem toast={t} />
        </div>
      ))}
      {onSeeMore && (
        <button type="button" className="map-activity-list-more" onClick={onSeeMore}>
          Voir tout →
        </button>
      )}
    </div>
  )
}
