import { useEffect, useState } from 'react'
import { listUpcomingExpeditions } from '../../lib/expeditionsApi'
import { useExpeditionsStore } from '../../stores/expeditionsStore'
import { ExpeditionCard } from './ExpeditionCard'
import './ExpeditionsList.css'

interface Props {
  onOpenExpedition: (expeditionId: string) => void
}

/**
 * Liste des expéditions à venir (statut 'published').
 * Chargée à l'ouverture du panneau, refresh à chaque mount.
 */
export function ExpeditionsList({ onOpenExpedition }: Props) {
  const [loading, setLoading] = useState(false)
  const upcoming = useExpeditionsStore((s) => s.upcoming)
  const setUpcoming = useExpeditionsStore((s) => s.setUpcoming)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listUpcomingExpeditions()
      .then((list) => { if (!cancelled) setUpcoming(list) })
      .catch(() => { /* silence — erreur déjà loggée côté supabase */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [setUpcoming])

  if (loading) {
    return <div className="expeditions-list-loading">Chargement…</div>
  }

  if (upcoming.length === 0) {
    return (
      <div className="expeditions-list-empty">
        Aucune expédition à venir. Crée la première.
      </div>
    )
  }

  return (
    <ul className="expeditions-list">
      {upcoming.map((e) => (
        <ExpeditionCard key={e.id} item={e} onClick={() => onOpenExpedition(e.id)} />
      ))}
    </ul>
  )
}
